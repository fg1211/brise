#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use chrono::{Duration, NaiveDateTime, SecondsFormat, Utc};
use flate2::read::ZlibDecoder;
use futures::stream::{self, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration as StdDuration, SystemTime, UNIX_EPOCH};
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size};

const BRIGHT_SKY: &str = "https://api.brightsky.dev";
const OPEN_METEO: &str = "https://api.open-meteo.com/v1/forecast";
const GEOCODING: &str = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_CACHE_SECONDS: i64 = 600;
const PLACE_CACHE_SECONDS: i64 = 7 * 24 * 60 * 60;
const RADAR_MAX_FRAMES: usize = 31;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
static CACHE_WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Brise/1.0 (Linux DWD weather client)")
            .timeout(StdDuration::from_secs(28))
            .connect_timeout(StdDuration::from_secs(8))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

/// Kurzer, stabiler Name für Cache-Dateien – ohne Kollisionen durch
/// Sonderzeichen oder unterschiedliche Orte mit gleichem Anfang.
fn cache_key(value: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in value.trim().to_lowercase().bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CityRequest {
    id: String,
    name: String,
    state: String,
    lat: f64,
    lon: f64,
    #[serde(default = "default_country")]
    country: String,
    #[serde(default = "default_provider")]
    provider: String,
}

fn default_country() -> String {
    "DE".into()
}

fn default_provider() -> String {
    "dwd".into()
}

impl CityRequest {
    /// DWD-Daten nur für Deutschland und nur auf ausdrücklichen Wunsch.
    /// Überall sonst – und wenn Open-Meteo gewählt wurde – nutzen wir
    /// die kostenlose Open-Meteo-API ohne Schlüssel und ohne Konto.
    fn uses_dwd(&self) -> bool {
        self.provider.eq_ignore_ascii_case("dwd") && self.country.eq_ignore_ascii_case("DE")
    }

    fn weather_key(&self) -> String {
        format!("{}-{}", self.id, if self.uses_dwd() { "dwd" } else { "open-meteo" })
    }

    fn validate(&self) -> Result<(), String> {
        if self.id.is_empty()
            || self.id.len() > 64
            || !self
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err("Ungültige Orts-ID.".into());
        }
        if !self.lat.is_finite() || !self.lon.is_finite() {
            return Err("Ungültige Koordinaten.".into());
        }
        if !(-90.0..=90.0).contains(&self.lat) || !(-180.0..=180.0).contains(&self.lon) {
            return Err("Koordinaten liegen außerhalb des gültigen Bereichs.".into());
        }
        if self.country.len() != 2 || !self.country.chars().all(|c| c.is_ascii_alphabetic()) {
            return Err("Ungültiger Ländercode.".into());
        }
        if !matches!(self.provider.to_ascii_lowercase().as_str(), "dwd" | "open-meteo") {
            return Err("Unbekannte Datenquelle.".into());
        }
        Ok(())
    }
}

async fn get_json_url(
    url: &str,
    query: &[(&str, String)],
) -> Result<Value, String> {
    let response = http()
        .get(url)
        .query(query)
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Antwort konnte nicht gelesen werden: {e}"))?;

    if !status.is_success() {
        let short = body.chars().take(220).collect::<String>();
        return Err(format!("Schnittstelle antwortet mit {status}. {short}"));
    }

    serde_json::from_str(&body).map_err(|e| format!("Ungültige API-Antwort: {e}"))
}

async fn get_json(path: &str, query: &[(&str, String)]) -> Result<Value, String> {
    get_json_url(&format!("{BRIGHT_SKY}{path}"), query).await
}

fn cache_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_cache_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn cache_path(app: &tauri::AppHandle, namespace: &str, id: &str) -> Option<PathBuf> {
    let base = cache_dir(app)?;
    let dir = base.join(namespace);
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join(format!("{id}.json")))
}

fn read_cache(path: &PathBuf) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn cache_age(value: &Value) -> i64 {
    let fetched = value.get("fetched_at").and_then(Value::as_i64).unwrap_or(0);
    Utc::now().timestamp() - fetched
}

fn write_cache(path: &PathBuf, value: &Value) {
    if let Ok(raw) = serde_json::to_vec(value) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let sequence = CACHE_WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let tmp = path.with_extension(format!(
            "json.tmp.{}.{}.{}",
            std::process::id(),
            nonce,
            sequence
        ));
        if fs::write(&tmp, raw).is_ok() {
            if fs::rename(&tmp, path).is_err() {
                let _ = fs::remove_file(&tmp);
            }
        }
    }
}

fn mark_stale(mut value: Value) -> Value {
    if let Some(object) = value.as_object_mut() {
        object.insert("stale".into(), Value::Bool(true));
    }
    value
}

fn active_alerts(mut value: Value) -> Value {
    if let Some(alerts) = value.get_mut("alerts").and_then(Value::as_array_mut) {
        alerts.retain(|alert| {
            let expires = alert
                .get("expires")
                .and_then(Value::as_str)
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
            expires
                .map(|t| t.timestamp() > Utc::now().timestamp())
                .unwrap_or(false)
        });
    }
    value
}

async fn fetch_current(city: &CityRequest) -> Result<Value, String> {
    get_json(
        "/current_weather",
        &[
            ("lat", city.lat.to_string()),
            ("lon", city.lon.to_string()),
            ("tz", "Europe/Berlin".into()),
            ("units", "dwd".into()),
            ("max_dist", "50000".into()),
        ],
    )
    .await
}

async fn fetch_weather(city: &CityRequest) -> Result<Value, String> {
    let now = Utc::now();
    let from = (now - Duration::hours(30)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let to = (now + Duration::days(7) + Duration::hours(3))
        .to_rfc3339_opts(SecondsFormat::Secs, true);

    get_json(
        "/weather",
        &[
            ("date", from),
            ("last_date", to),
            ("lat", city.lat.to_string()),
            ("lon", city.lon.to_string()),
            ("tz", "Europe/Berlin".into()),
            ("units", "dwd".into()),
        ],
    )
    .await
}

async fn fetch_alerts(city: &CityRequest) -> Result<Value, String> {
    get_json(
        "/alerts",
        &[
            ("lat", city.lat.to_string()),
            ("lon", city.lon.to_string()),
            ("tz", "Europe/Berlin".into()),
        ],
    )
    .await
}

fn build_bundle(
    current: Value,
    hourly: Value,
    alerts: Result<Value, String>,
    cached: Option<&Value>,
) -> Value {
    let current_weather = current
        .get("weather")
        .cloned()
        .unwrap_or(Value::Null);
    let current_sources = current
        .get("sources")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let hourly_records = hourly
        .get("weather")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let hourly_sources = hourly
        .get("sources")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    let (alert_records, alerts_available) = match alerts {
        Ok(value) => {
            (
                value
                    .get("alerts")
                    .cloned()
                    .unwrap_or_else(|| Value::Array(Vec::new())),
                true,
            )
        }
        Err(err) => {
            eprintln!("[brise] Warnungen konnten nicht geladen werden: {err}");
            let fallback = cached
                .and_then(|value| value.get("alerts").cloned())
                .unwrap_or_else(|| Value::Array(Vec::new()));
            let available = cached
                .and_then(|value| value.get("alerts_available").and_then(Value::as_bool))
                .unwrap_or(false);
            (fallback, available)
        }
    };

    active_alerts(json!({
        "fetched_at": Utc::now().timestamp(),
        "stale": false,
        "current": current_weather,
        "current_sources": current_sources,
        "hourly": hourly_records,
        "sources": hourly_sources,
        "alerts": alert_records,
        "alerts_available": alerts_available,
        "timezone": "Europe/Berlin",
        "provider": "dwd",
    }))
}

fn json_number(record: &Value, key: &str) -> Value {
    record
        .get(key)
        .and_then(Value::as_f64)
        .map(|value| json!(value))
        .unwrap_or(Value::Null)
}

fn open_meteo_timestamp(value: Option<&str>, offset_seconds: i64) -> Value {
    let raw = match value {
        Some(raw) => raw,
        None => return Value::Null,
    };
    let parsed = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M")
        .or_else(|_| NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S"))
        .ok();
    match parsed {
        Some(naive) => json!(naive.and_utc().timestamp() - offset_seconds),
        None => Value::Null,
    }
}

fn open_meteo_condition(code: i64, is_day: bool) -> (&'static str, &'static str) {
    match code {
        0 => (
            if is_day { "clear-day" } else { "clear-night" },
            "dry",
        ),
        1 | 2 => (
            if is_day { "partly-cloudy-day" } else { "partly-cloudy-night" },
            "dry",
        ),
        3 => ("cloudy", "dry"),
        45 | 48 => ("fog", "fog"),
        51 | 53 | 55 | 61 | 63 | 65 | 80 | 81 | 82 => ("rain", "rain"),
        56 | 57 | 66 | 67 => ("sleet", "sleet"),
        71 | 73 | 75 | 77 | 85 | 86 => ("snow", "snow"),
        95 | 96 | 99 => ("thunderstorm", "thunderstorm"),
        _ => ("cloudy", "dry"),
    }
}

/// Open-Meteo liefert dieselben Werte wie Bright Sky, nur in anderen
/// Feldnamen. Wir formen sie hier in das vorhandene Brise-Format um, damit
/// Oberfläche und Cache unverändert bleiben.
async fn fetch_open_meteo_bundle(city: &CityRequest) -> Result<Value, String> {
    let current_fields = "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";
    let hourly_fields = "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,weather_code,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,sunshine_duration,shortwave_radiation,is_day";
    let response = get_json_url(
        OPEN_METEO,
        &[
            ("latitude", city.lat.to_string()),
            ("longitude", city.lon.to_string()),
            ("current", current_fields.into()),
            ("hourly", hourly_fields.into()),
            ("timezone", "auto".into()),
            ("forecast_days", "8".into()),
            ("past_days", "2".into()),
            ("wind_speed_unit", "kmh".into()),
            ("precipitation_unit", "mm".into()),
        ],
    )
    .await?;

    let offset = response
        .get("utc_offset_seconds")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let current_raw = response.get("current").cloned().unwrap_or(Value::Null);
    let code = current_raw
        .get("weather_code")
        .and_then(Value::as_i64)
        .unwrap_or(3);
    let is_day = current_raw
        .get("is_day")
        .and_then(Value::as_i64)
        .unwrap_or(1)
        != 0;
    let (icon, condition) = open_meteo_condition(code, is_day);
    let current = json!({
        "timestamp": open_meteo_timestamp(current_raw.get("time").and_then(Value::as_str), offset),
        "icon": icon,
        "condition": condition,
        "cloud_cover": json_number(&current_raw, "cloud_cover"),
        "temperature": json_number(&current_raw, "temperature_2m"),
        "relative_humidity": json_number(&current_raw, "relative_humidity_2m"),
        "dew_point": json_number(&current_raw, "dew_point_2m"),
        "wind_speed_10": json_number(&current_raw, "wind_speed_10m"),
        "wind_gust_speed_10": json_number(&current_raw, "wind_gusts_10m"),
        "wind_direction_10": json_number(&current_raw, "wind_direction_10m"),
        "pressure_msl": json_number(&current_raw, "pressure_msl"),
        "visibility": json_number(&current_raw, "visibility"),
        "precipitation_60": json_number(&current_raw, "precipitation"),
    });

    let hourly_raw = response.get("hourly").cloned().unwrap_or(Value::Null);
    let times = hourly_raw
        .get("time")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut hourly = Vec::with_capacity(times.len());
    for (index, time) in times.iter().enumerate() {
        let at = |key: &str| {
            hourly_raw
                .get(key)
                .and_then(Value::as_array)
                .and_then(|values| values.get(index))
                .cloned()
                .unwrap_or(Value::Null)
        };
        let temperature = at("temperature_2m").as_f64();
        if temperature.is_none() {
            continue;
        }
        let code = at("weather_code").as_i64().unwrap_or(3);
        let is_day = at("is_day").as_i64().unwrap_or(1) != 0;
        let (icon, condition) = open_meteo_condition(code, is_day);
        hourly.push(json!({
            "timestamp": open_meteo_timestamp(time.as_str(), offset),
            "icon": icon,
            "condition": condition,
            "temperature": temperature,
            "relative_humidity": at("relative_humidity_2m"),
            "dew_point": at("dew_point_2m"),
            "precipitation": at("precipitation"),
            "precipitation_probability": at("precipitation_probability"),
            "wind_direction": at("wind_direction_10m"),
            "wind_speed": at("wind_speed_10m"),
            "wind_gust_speed": at("wind_gusts_10m"),
            "pressure_msl": at("pressure_msl"),
            "visibility": at("visibility"),
            // Open-Meteo liefert Sonnenschein in Sekunden, Brise rechnet in Minuten.
            "sunshine": json!(at("sunshine_duration").as_f64().map(|value| value / 60.0)),
            "solar": at("shortwave_radiation"),
            "cloud_cover": at("cloud_cover"),
        }));
    }

    let sources = json!([{
        "id": "open-meteo",
        "station_name": "Open-Meteo",
    }]);
    Ok(json!({
        "fetched_at": Utc::now().timestamp(),
        "stale": false,
        "current": current,
        "current_sources": sources,
        "hourly": hourly,
        "sources": sources,
        "alerts": [],
        "alerts_available": false,
        "provider": "open-meteo",
        "timezone": response.get("timezone").cloned().unwrap_or(Value::Null),
    }))
}

#[tauri::command]
async fn get_weather(
    app: tauri::AppHandle,
    city: CityRequest,
    force: Option<bool>,
) -> Result<Value, String> {
    city.validate()?;
    let force = force.unwrap_or(false);
    let path = cache_path(&app, "weather", &city.weather_key());
    let cached = path.as_ref().and_then(read_cache);

    if !force {
        if let Some(cached) = cached.as_ref() {
            let age = cache_age(cached);
            if (0..WEATHER_CACHE_SECONDS).contains(&age) {
                return Ok(cached.clone());
            }
        }
    }

    let result = if city.uses_dwd() {
        let current_fut = fetch_current(&city);
        let weather_fut = fetch_weather(&city);
        let alerts_fut = fetch_alerts(&city);
        let (current, hourly, alerts) = futures::join!(current_fut, weather_fut, alerts_fut);
        match (current, hourly) {
            (Ok(current), Ok(hourly)) => {
                Ok(build_bundle(current, hourly, alerts, cached.as_ref()))
            }
            (current_result, hourly_result) => Err(current_result
                .err()
                .or_else(|| hourly_result.err())
                .unwrap_or_else(|| "Unbekannter Fehler".to_string())),
        }
    } else {
        fetch_open_meteo_bundle(&city).await
    };

    match result {
        Ok(bundle) => {
            if let Some(path) = path {
                write_cache(&path, &bundle);
            }
            Ok(bundle)
        }
        Err(reason) => {
            if let Some(cached) = cached {
                eprintln!("[brise] Netzwerkfehler, nutze Cache für {}: {reason}", city.name);
                Ok(mark_stale(cached))
            } else {
                Err(reason)
            }
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RadarRequest {
    lat: f64,
    lon: f64,
    distance: Option<u32>,
}

fn decode_radar_frame(
    encoded: &str,
    full_width: usize,
    full_height: usize,
    step: usize,
) -> Option<(usize, usize, String)> {
    let compressed = base64::engine::general_purpose::STANDARD
        .decode(encoded.as_bytes())
        .ok()?;
    let expected = full_width * full_height * 2;
    let mut decoder = ZlibDecoder::new(compressed.as_slice()).take(expected as u64 + 1);
    let mut raw = Vec::with_capacity(expected);
    decoder.read_to_end(&mut raw).ok()?;
    if raw.len() != expected {
        return None;
    }

    let width = (full_width + step - 1) / step;
    let height = (full_height + step - 1) / step;
    let mut out = vec![0u8; width * height];
    let mut sums = vec![0u64; width * height];
    let mut counts = vec![0u32; width * height];

    for y in 0..full_height {
        for x in 0..full_width {
            let index = (y * full_width + x) * 2;
            let value = u16::from_le_bytes([raw[index], raw[index + 1]]) as u64;
            if value == 0 {
                continue;
            }
            let slot = (y / step) * width + (x / step);
            sums[slot] += value;
            counts[slot] += 1;
        }
    }

    for (slot, sum) in sums.iter().enumerate() {
        if counts[slot] > 0 {
            out[slot] = (*sum / counts[slot] as u64).min(255) as u8;
        }
    }

    Some((
        width,
        height,
        base64::engine::general_purpose::STANDARD.encode(out),
    ))
}

#[tauri::command]
async fn get_radar(app: tauri::AppHandle, request: RadarRequest) -> Result<Value, String> {
    if !request.lat.is_finite()
        || !request.lon.is_finite()
        || !(-90.0..=90.0).contains(&request.lat)
        || !(-180.0..=180.0).contains(&request.lon)
    {
        return Err("Ungültige Radar-Koordinaten.".into());
    }
    let distance = request.distance.unwrap_or(120_000).clamp(30_000, 200_000);
    let now = Utc::now();
    let cache_id = format!(
        "{}_{}_{}",
        cache_key(&format!("{:.4}", request.lat)),
        cache_key(&format!("{:.4}", request.lon)),
        distance
    );
    let path = cache_path(&app, "radar", &cache_id);
    let cached = path.as_ref().and_then(read_cache);
    if let Some(cached) = cached.as_ref() {
        let age = cache_age(cached);
        if (0..240).contains(&age) {
            return Ok(cached.clone());
        }
    }
    let from = (now - Duration::minutes(65)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let to = (now + Duration::minutes(95)).to_rfc3339_opts(SecondsFormat::Secs, true);

    let payload_result = get_json(
        "/radar",
        &[
            ("lat", request.lat.to_string()),
            ("lon", request.lon.to_string()),
            ("distance", distance.to_string()),
            ("date", from),
            ("last_date", to),
            ("format", "compressed".into()),
            ("tz", "Europe/Berlin".into()),
        ],
    )
    .await;
    let payload = match payload_result {
        Ok(payload) => payload,
        Err(err) => {
            return cached
                .map(mark_stale)
                .ok_or_else(|| format!("Radar nicht erreichbar: {err}"));
        }
    };

    let bbox = payload
        .get("bbox")
        .and_then(Value::as_array)
        .ok_or_else(|| "Radar-Antwort ohne Bounding-Box.".to_string())?;
    if bbox.len() != 4 {
        return Err("Ungültige Radar-Bounding-Box.".into());
    }
    let top = bbox[0].as_u64().ok_or("Ungültige Radar-Box.")? as usize;
    let left = bbox[1].as_u64().ok_or("Ungültige Radar-Box.")? as usize;
    let bottom = bbox[2].as_u64().ok_or("Ungültige Radar-Box.")? as usize;
    let right = bbox[3].as_u64().ok_or("Ungültige Radar-Box.")? as usize;
    let full_width = right.saturating_sub(left) + 1;
    let full_height = bottom.saturating_sub(top) + 1;
    if full_width == 0 || full_height == 0 || full_width > 900 || full_height > 900 {
        return Err("Ungültige Radar-Auflösung.".into());
    }

    let step = ((full_width.max(full_height) as f64 / 180.0).ceil() as usize).max(1);
    let radar_records = payload
        .get("radar")
        .and_then(Value::as_array)
        .ok_or_else(|| "Radar-Antwort ohne Datensätze.".to_string())?;

    let mut frames: Vec<Value> = Vec::new();
    for record in radar_records.iter().rev().take(RADAR_MAX_FRAMES).rev() {
        let timestamp = match record.get("timestamp").and_then(Value::as_str) {
            Some(value) => value,
            None => continue,
        };
        let encoded = match record.get("precipitation_5").and_then(Value::as_str) {
            Some(value) => value,
            None => continue,
        };
        if let Some((width, height, data)) =
            decode_radar_frame(encoded, full_width, full_height, step)
        {
            frames.push(json!({
                "timestamp": timestamp,
                "width": width,
                "height": height,
                "data": data,
            }));
        }
    }

    if frames.is_empty() {
        return cached
            .map(mark_stale)
            .ok_or_else(|| "Für diesen Zeitraum liegen keine Radardaten vor.".to_string());
    }

    let last_source = radar_records
        .last()
        .and_then(|r| r.get("source"))
        .and_then(Value::as_str)
        .unwrap_or("DWD RV");

    let bundle = json!({
        "frames": frames,
        "bbox": bbox,
        "geometry": payload.get("geometry").cloned().unwrap_or(Value::Null),
        "latlon_position": payload.get("latlon_position").cloned().unwrap_or(Value::Null),
        "step": step,
        "grid_width": full_width,
        "grid_height": full_height,
        "distance": distance,
        "source": last_source,
        "fetched_at": now.timestamp(),
        "stale": false,
    });
    if let Some(path) = path {
        write_cache(&path, &bundle);
    }
    Ok(bundle)
}

async fn fetch_summary(
    app: &tauri::AppHandle,
    city: CityRequest,
    force: bool,
) -> Value {
    let path = cache_path(app, "summaries", &city.weather_key());
    let cached = path.as_ref().and_then(read_cache);

    if !force {
        if let Some(value) = cached.as_ref() {
            let age = cache_age(value);
            if (0..WEATHER_CACHE_SECONDS).contains(&age) {
                return value.clone();
            }
        }
    }

    let result = if city.uses_dwd() {
        match fetch_current(&city).await {
            Ok(current) => Ok((
                current.get("weather").cloned().unwrap_or(Value::Null),
                current
                    .get("sources")
                    .cloned()
                    .unwrap_or_else(|| Value::Array(Vec::new())),
            )),
            Err(error) => Err(error),
        }
    } else {
        match fetch_open_meteo_bundle(&city).await {
            Ok(bundle) => Ok((
                bundle.get("current").cloned().unwrap_or(Value::Null),
                bundle
                    .get("current_sources")
                    .cloned()
                    .unwrap_or_else(|| Value::Array(Vec::new())),
            )),
            Err(error) => Err(error),
        }
    };

    match result {
        Ok((weather, sources)) => {
            if weather.is_null() {
                if let Some(cached) = cached {
                    return mark_stale(cached);
                }
                return json!({
                    "city_id": city.id,
                    "weather": Value::Null,
                    "error": "Keine aktuelle Beobachtung verfügbar."
                });
            }
            let summary = json!({
                "city_id": city.id,
                "name": city.name,
                "state": city.state,
                "fetched_at": Utc::now().timestamp(),
                "stale": false,
                "weather": weather,
                "sources": sources,
            });
            if let Some(path) = path {
                write_cache(&path, &summary);
            }
            summary
        }
        Err(err) => {
            if let Some(cached) = cached {
                return mark_stale(cached);
            }
            json!({
                "city_id": city.id,
                "name": city.name,
                "state": city.state,
                "fetched_at": Utc::now().timestamp(),
                "stale": true,
                "weather": Value::Null,
                "error": err,
            })
        }
    }
}

#[tauri::command]
async fn get_current_summaries(
    app: tauri::AppHandle,
    cities: Vec<CityRequest>,
    force: Option<bool>,
) -> Result<Vec<Value>, String> {
    if cities.is_empty() {
        return Ok(Vec::new());
    }
    if cities.len() > 80 {
        return Err("Zu viele Städte angefragt.".into());
    }
    for city in &cities {
        city.validate()?;
    }

    let force = force.unwrap_or(false);
    let app_for_tasks = app.clone();
    let tasks = stream::iter(cities.into_iter().map(move |city| {
        let app = app_for_tasks.clone();
        async move { fetch_summary(&app, city, force).await }
    }))
    // Nicht alle Favoriten gleichzeitig abfragen: zu viele parallele DWD-
    // Antworten blockieren den WebKit-Hauptthread und das Scrollen ruckelt.
    .buffer_unordered(2)
    .collect::<Vec<Value>>()
    .await;

    Ok(tasks)
}

/// Ortsuche für jedes Land. Land und Sprache kommen aus den Einstellungen;
/// ohne Angabe bleibt Deutschland die Vorauswahl.
#[tauri::command]
async fn search_places(
    app: tauri::AppHandle,
    query: String,
    country: Option<String>,
    language: Option<String>,
) -> Result<Value, String> {
    let query = query.trim();
    if query.chars().count() < 2 || query.chars().count() > 80 {
        return Ok(json!({ "results": [] }));
    }

    let country_code = country
        .unwrap_or_else(|| "DE".into())
        .trim()
        .to_uppercase();
    let lang = language
        .unwrap_or_else(|| "de".into())
        .trim()
        .to_lowercase();
    let cache_id = format!("{country_code}|{lang}|{query}");
    let path = cache_path(&app, "places", &cache_key(&cache_id));
    if let Some(cached) = path.as_ref().and_then(read_cache) {
        let age = cache_age(&cached);
        if (0..PLACE_CACHE_SECONDS).contains(&age) {
            return Ok(cached);
        }
    }

    let mut params = vec![
        ("name", query.to_string()),
        ("count", "15".into()),
        ("language", lang.clone()),
        ("format", "json".into()),
    ];
    if country_code.len() == 2 && country_code != "ALL" {
        params.push(("countryCode", country_code.clone()));
    }

    let response = http()
        .get(GEOCODING)
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("Ortsuche nicht erreichbar: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Antwort der Ortsuche konnte nicht gelesen werden: {e}"))?;
    if !status.is_success() {
        let short = body.chars().take(220).collect::<String>();
        return Err(format!("Ortsuche antwortet mit {status}. {short}"));
    }
    let parsed: Value =
        serde_json::from_str(&body).map_err(|e| format!("Ungültige Antwort der Ortsuche: {e}"))?;
    if parsed.get("error").and_then(Value::as_bool).unwrap_or(false) {
        let reason = parsed
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or("unbekannter Grund");
        return Err(format!("Ortsuche meldet einen Fehler: {reason}"));
    }

    let raw = parsed
        .get("results")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut results: Vec<Value> = raw
        .into_iter()
        .filter(|place| {
            if country_code == "ALL" || country_code.len() != 2 {
                return true;
            }
            place
                .get("country_code")
                .and_then(Value::as_str)
                .map(|code| code.eq_ignore_ascii_case(&country_code))
                .unwrap_or(false)
        })
        .filter_map(|place| {
            let name = place.get("name").and_then(Value::as_str).unwrap_or("");
            let lat = place.get("latitude").and_then(Value::as_f64).unwrap_or(f64::NAN);
            let lon = place.get("longitude").and_then(Value::as_f64).unwrap_or(f64::NAN);
            if name.is_empty()
                || !lat.is_finite()
                || !lon.is_finite()
                || !(-90.0..=90.0).contains(&lat)
                || !(-180.0..=180.0).contains(&lon)
            {
                return None;
            }
            let geo_id = place.get("id").and_then(Value::as_i64).unwrap_or(0);
            let id = if geo_id > 0 {
                format!("ort-{geo_id}")
            } else {
                format!("ort-{}", cache_key(&format!("{name}|{lat:.5}|{lon:.5}")))
            };
            let state = place
                .get("admin1")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .or_else(|| place.get("admin3").and_then(Value::as_str))
                .filter(|value| !value.is_empty())
                .or_else(|| place.get("country").and_then(Value::as_str))
                .unwrap_or("Deutschland")
                .to_string();
            let place_country = place
                .get("country_code")
                .and_then(Value::as_str)
                .unwrap_or("DE")
                .to_uppercase();
            Some(json!({
                "id": id,
                "name": name,
                "state": state,
                "country": place.get("country").and_then(Value::as_str).unwrap_or("Deutschland"),
                "countryCode": place_country,
                "lat": lat,
                "lon": lon,
                "population": place.get("population").and_then(Value::as_u64).unwrap_or(0),
                "kind": place.get("feature_code").and_then(Value::as_str).unwrap_or(""),
            }))
        })
        .collect();

    results.sort_by(|a, b| {
        let rank = |value: &Value| {
            let population = value.get("population").and_then(Value::as_u64).unwrap_or(0);
            let name = value.get("name").and_then(Value::as_str).unwrap_or("");
            let local = normalize_search(name) == normalize_search(query);
            (!local, std::cmp::Reverse(population))
        };
        rank(a).cmp(&rank(b))
    });

    let bundle = json!({ "results": results, "fetched_at": Utc::now().timestamp() });
    if let Some(path) = path {
        write_cache(&path, &bundle);
    }
    Ok(bundle)
}

fn normalize_search(value: &str) -> String {
    value
        .to_lowercase()
        .replace('ä', "ae")
        .replace('ö', "oe")
        .replace('ü', "ue")
        .replace('ß', "ss")
}

/// Den Zielmonitor ausdrücklich beim Namen wählen. Auf Hyprland übernimmt der
/// Launcher die Platzierung per Fensterregel; hier werden X11 und die
/// Größenberechnung abgedeckt. Der Hauptmonitor bleibt unangetastet.
fn place_on_secondary_monitor(window: &tauri::WebviewWindow) {
    let monitors = match window.available_monitors() {
        Ok(monitors) => monitors,
        Err(_) => return,
    };
    let wanted = std::env::var("BRISE_MONITOR").unwrap_or_else(|_| "DP-2".into());
    let primary = window.primary_monitor().ok().flatten();

    let target = monitors
        .iter()
        .find(|monitor| monitor.name().is_some_and(|name| name == &wanted))
        .or_else(|| {
            monitors.iter().find(|monitor| {
                primary
                    .as_ref()
                    .map(|primary| monitor.name() != primary.name())
                    .unwrap_or(false)
            })
        });

    if let Some(monitor) = target {
        let area = monitor.work_area();
        let scale = monitor.scale_factor().max(1.0);
        let desired_width = (1440.0 * scale).round() as u32;
        let desired_height = (900.0 * scale).round() as u32;
        let width = desired_width
            .min(area.size.width.saturating_sub(48))
            .max(1);
        let height = desired_height
            .min(area.size.height.saturating_sub(80))
            .max(1);
        let x = area.position.x + ((area.size.width.saturating_sub(width)) / 2) as i32;
        let y = area.position.y + ((area.size.height.saturating_sub(height)) / 2) as i32;

        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        let _ = window.set_size(Size::Physical(PhysicalSize::new(width, height)));
    }
}

#[cfg(target_os = "linux")]
mod webkit_ffi {
    use std::ffi::{c_char, c_int, c_void};
    use std::sync::atomic::{AtomicIsize, Ordering};

    // GDKs Frame-Clock kennt die Monitorfrequenz bei GL-Fenstern nicht:
    // eglSwapBuffers committed das Surface selbst, dadurch holt GDK keinen
    // Wayland-Frame-Callback und wartet fest 1/60 s. Wir schreiben das
    // Intervall in die Timings des aktuellen Frames. GdkFrameTimings ist
    // privat; je nach GTK-Version liegt refresh_interval bei Offset 56 oder
    // 48. Der Getter entscheidet, welcher Offset gilt.
    static REFRESH_OFFSET: AtomicIsize = AtomicIsize::new(0);

    extern "C" {
        fn gtk_widget_get_frame_clock(widget: *mut c_void) -> *mut c_void;
        fn gtk_widget_get_window(widget: *mut c_void) -> *mut c_void;
        fn gdk_window_get_display(window: *mut c_void) -> *mut c_void;
        fn gdk_display_get_monitor_at_window(
            display: *mut c_void,
            window: *mut c_void,
        ) -> *mut c_void;
        fn gdk_monitor_get_refresh_rate(monitor: *mut c_void) -> i32;
        fn gdk_frame_clock_get_current_timings(clock: *mut c_void) -> *mut c_void;
        fn gdk_frame_timings_get_refresh_interval(timings: *mut c_void) -> i64;

        fn webkit_settings_get_all_features() -> *mut c_void;
        fn webkit_feature_list_find(list: *mut c_void, identifier: *const c_char) -> *mut c_void;
        fn webkit_settings_set_feature_enabled(
            settings: *mut c_void,
            feature: *mut c_void,
            enabled: c_int,
        );
        fn webkit_feature_list_unref(list: *mut c_void);
    }

    /// Die Frame-Clock jedes gezeichneten Frames auf den Monitor-Takt
    /// trimmen. GL-Fenster bekommen sonst 60 Hz, obwohl der Monitor 180 Hz
    /// meldet; ohne GL läuft alles, aber in Software und ruckelt.
    pub fn pace_frame_clock(widget: *mut c_void) {
        let offset = REFRESH_OFFSET.load(Ordering::Relaxed);
        if offset < 0 {
            return;
        }

        let clock = unsafe { gtk_widget_get_frame_clock(widget) };
        if clock.is_null() {
            return;
        }
        let timings = unsafe { gdk_frame_clock_get_current_timings(clock) };
        if timings.is_null() || unsafe { gdk_frame_timings_get_refresh_interval(timings) } != 0 {
            return;
        }

        let window = unsafe { gtk_widget_get_window(widget) };
        if window.is_null() {
            return;
        }
        let display = unsafe { gdk_window_get_display(window) };
        if display.is_null() {
            return;
        }
        let monitor = unsafe { gdk_display_get_monitor_at_window(display, window) };
        if monitor.is_null() {
            return;
        }
        let milli_hz = unsafe { gdk_monitor_get_refresh_rate(monitor) };
        if milli_hz <= 0 {
            return;
        }
        let interval = 1_000_000_000i64 / milli_hz as i64;

        let candidates = if offset > 0 {
            &[offset as usize][..]
        } else {
            &[56usize, 48][..]
        };
        for candidate in candidates {
            let field = unsafe { (timings as *mut u8).add(*candidate) as *mut i64 };
            if unsafe { *field } != 0 {
                continue;
            }
            unsafe { *field = interval };
            if unsafe { gdk_frame_timings_get_refresh_interval(timings) } == interval {
                REFRESH_OFFSET.store(*candidate as isize, Ordering::Relaxed);
                return;
            }
            unsafe { *field = 0 };
        }
        REFRESH_OFFSET.store(-1, Ordering::Relaxed);
    }

    /// WebKit standardmäßig auf die echte Monitorfrequenz trimmen statt auf
    /// „nah an 60 fps“. `enabled = true` schaltet das 60-fps-Limit ein,
    /// `enabled = false` lässt WebKit mit der Bildwiederholrate laufen.
    /// Die Feature-API ist in der Rust-Bindung noch nicht enthalten, daher
    /// rufen wir sie direkt auf.
    ///
    /// Zusätzlich bekommt GTKs Frame-Clock pro Frame die echte Monitorrate:
    /// Bei GL-Fenstern fragt GDK den Compositor nicht nach dem Intervall und
    /// wartet sonst immer 1/60 s – auch auf 180-Hz-Displays. GdkFrameTimings
    /// ist privat; das gesetzte Feld wird über seinen Getter verifiziert.
    pub fn set_prefer_near_60_fps(settings: &webkit2gtk::Settings, enabled: bool) {
        use webkit2gtk::glib::translate::ToGlibPtr;

        let features = unsafe { webkit_settings_get_all_features() };
        if features.is_null() {
            return;
        }

        let identifier = b"PreferPageRenderingUpdatesNear60FPS\0";
        let feature = unsafe { webkit_feature_list_find(features, identifier.as_ptr().cast()) };
        if !feature.is_null() {
            let settings_ptr = ToGlibPtr::<*mut webkit2gtk::ffi::WebKitSettings>::to_glib_none(settings).0;
            unsafe {
                webkit_settings_set_feature_enabled(settings_ptr.cast(), feature, i32::from(enabled));
            }
        }
        unsafe { webkit_feature_list_unref(features) };
    }
}

/// WebKitGTK dauerhaft auf Hardwarebeschleunigung trimmen. Das betrifft auch
/// das Scrollen: Compositing, 2D-Canvas und WebGL laufen dann über die GPU.
/// Die Frame-Clock bekommt bei jedem Frame die Monitorfrequenz, damit GL und
/// 180 Hz zusammen funktionieren.
#[cfg(target_os = "linux")]
fn enable_gpu_acceleration(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| {
        use gtk::prelude::*;
        use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};

        let webview = webview.inner();
        let Some(settings) = WebViewExt::settings(&webview) else {
            return;
        };
        settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Always);
        settings.set_enable_webgl(true);
        settings.set_enable_smooth_scrolling(true);
        webkit_ffi::set_prefer_near_60_fps(&settings, false);

        let widget = webview.as_ptr() as *mut std::ffi::c_void;
        webview.connect_draw(move |_, _| {
            webkit_ffi::pace_frame_clock(widget);
            false.into()
        });
    });
}

/// Hardwarebeschleunigung zur Laufzeit umschalten. Für eine verlässliche
/// Wirkung danach Neustart oder Neuladen empfohlen.
#[tauri::command]
fn set_hardware_acceleration(_app: tauri::AppHandle, enabled: bool) {
    #[cfg(target_os = "linux")]
    if let Some(window) = _app.get_webview_window("main") {
        let _ = window.with_webview(move |webview| {
            use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};
            let webview = webview.inner();
            if let Some(settings) = webview.settings() {
                let policy = if enabled {
                    HardwareAccelerationPolicy::Always
                } else {
                    HardwareAccelerationPolicy::Never
                };
                settings.set_hardware_acceleration_policy(policy);
                settings.set_enable_webgl(enabled);
            }
        });
    }
}

/// VSync umschalten: an bedeutet Renderen im Monitor-Takt, aus bedeutet das
/// WebKit-eigene Limit „nah an 60 fps“.
#[tauri::command]
fn set_vsync(_app: tauri::AppHandle, enabled: bool) {
    #[cfg(target_os = "linux")]
    if let Some(window) = _app.get_webview_window("main") {
        let _ = window.with_webview(move |webview| {
            use webkit2gtk::WebViewExt;
            let webview = webview.inner();
            if let Some(settings) = webview.settings() {
                webkit_ffi::set_prefer_near_60_fps(&settings, !enabled);
            }
        });
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Keep the WebView surface fully opaque. WebKitGTK otherwise
            // composites translucent page layers against the desktop.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(7, 15, 23, 255)));
                #[cfg(target_os = "linux")]
                enable_gpu_acceleration(&window);
                place_on_secondary_monitor(&window);
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_weather,
            get_current_summaries,
            get_radar,
            search_places,
            set_hardware_acceleration,
            set_vsync
        ])
        .run(tauri::generate_context!())
        .expect("error while running Brise");
}

