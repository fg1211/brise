#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use chrono::{Duration, SecondsFormat, Utc};
use flate2::read::ZlibDecoder;
use futures::stream::{self, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration as StdDuration;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size};

const BRIGHT_SKY: &str = "https://api.brightsky.dev";
const GEOCODING: &str = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_CACHE_SECONDS: i64 = 600;
const PLACE_CACHE_SECONDS: i64 = 7 * 24 * 60 * 60;
const RADAR_MAX_FRAMES: usize = 31;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Brise/1.0 (Linux DWD weather client)")
            .timeout(StdDuration::from_secs(28))
            .connect_timeout(StdDuration::from_secs(8))
            .build()
            .expect("failed to build HTTP client")
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CityRequest {
    id: String,
    name: String,
    state: String,
    lat: f64,
    lon: f64,
}

impl CityRequest {
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
        Ok(())
    }
}

async fn get_json(
    path: &str,
    query: &[(&str, String)],
) -> Result<Value, String> {
    let url = format!("{BRIGHT_SKY}{path}");
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
        return Err(format!(
            "DWD-Schnittstelle antwortet mit {status}. {short}"
        ));
    }

    serde_json::from_str(&body).map_err(|e| format!("Ungültige API-Antwort: {e}"))
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
        let tmp = path.with_extension("json.tmp");
        if fs::write(&tmp, raw).is_ok() {
            let _ = fs::rename(tmp, path);
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
            expires.map(|t| t.timestamp() > Utc::now().timestamp() - 300).unwrap_or(true)
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

fn build_bundle(current: Value, hourly: Value, alerts: Result<Value, String>) -> Value {
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
            let value = active_alerts(value);
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
            (Value::Array(Vec::new()), false)
        }
    };

    json!({
        "fetched_at": Utc::now().timestamp(),
        "stale": false,
        "current": current_weather,
        "current_sources": current_sources,
        "hourly": hourly_records,
        "sources": hourly_sources,
        "alerts": alert_records,
        "alerts_available": alerts_available,
    })
}

#[tauri::command]
async fn get_weather(
    app: tauri::AppHandle,
    city: CityRequest,
    force: Option<bool>,
) -> Result<Value, String> {
    city.validate()?;
    let force = force.unwrap_or(false);
    let path = cache_path(&app, "weather", &city.id);
    let cached = path.as_ref().and_then(read_cache);

    if !force {
        if let Some(cached) = cached.as_ref() {
            let age = cache_age(cached);
            if (0..WEATHER_CACHE_SECONDS).contains(&age) {
                return Ok(cached.clone());
            }
        }
    }

    let current_fut = fetch_current(&city);
    let weather_fut = fetch_weather(&city);
    let alerts_fut = fetch_alerts(&city);
    let (current, hourly, alerts) = futures::join!(current_fut, weather_fut, alerts_fut);

    match (current, hourly) {
        (Ok(current), Ok(hourly)) => {
            let bundle = build_bundle(current, hourly, alerts);
            if let Some(path) = path {
                write_cache(&path, &bundle);
            }
            Ok(bundle)
        }
        (current_result, hourly_result) => {
            let reason = current_result
                .err()
                .or_else(|| hourly_result.err())
                .unwrap_or_else(|| "Unbekannter Fehler".to_string());
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
    let mut decoder = ZlibDecoder::new(compressed.as_slice());
    let mut raw = Vec::with_capacity(full_width * full_height * 2);
    decoder.read_to_end(&mut raw).ok()?;
    if raw.len() != full_width * full_height * 2 {
        return None;
    }

    let width = (full_width + step - 1) / step;
    let height = (full_height + step - 1) / step;
    let mut out = vec![0u8; width * height];

    for y in 0..full_height {
        for x in 0..full_width {
            let index = (y * full_width + x) * 2;
            let value = u16::from_le_bytes([raw[index], raw[index + 1]]).min(255) as u8;
            if value == 0 {
                continue;
            }
            let ox = x / step;
            let oy = y / step;
            let slot = oy * width + ox;
            if value > out[slot] {
                out[slot] = value;
            }
        }
    }

    Some((
        width,
        height,
        base64::engine::general_purpose::STANDARD.encode(out),
    ))
}

#[tauri::command]
async fn get_radar(request: RadarRequest) -> Result<Value, String> {
    if !request.lat.is_finite() || !request.lon.is_finite() {
        return Err("Ungültige Radar-Koordinaten.".into());
    }
    let distance = request.distance.unwrap_or(120_000).clamp(30_000, 200_000);
    let now = Utc::now();
    let from = (now - Duration::minutes(65)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let to = (now + Duration::minutes(95)).to_rfc3339_opts(SecondsFormat::Secs, true);

    let payload = get_json(
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
    .await?;

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
        return Err("Für diesen Zeitraum liegen keine Radardaten vor.".into());
    }

    let last_source = radar_records
        .last()
        .and_then(|r| r.get("source"))
        .and_then(Value::as_str)
        .unwrap_or("DWD RV");

    Ok(json!({
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
    }))
}

async fn fetch_summary(
    app: &tauri::AppHandle,
    city: CityRequest,
    force: bool,
) -> Value {
    let path = cache_path(app, "summaries", &city.id);
    let cached = path.as_ref().and_then(read_cache);

    if !force {
        if let Some(value) = cached.as_ref() {
            let age = cache_age(value);
            if (0..WEATHER_CACHE_SECONDS).contains(&age) {
                return value.clone();
            }
        }
    }

    match fetch_current(&city).await {
        Ok(current) => {
            let weather = current.get("weather").cloned().unwrap_or(Value::Null);
            if weather.is_null() {
                if let Some(cached) = cached {
                    return mark_stale(cached);
                }
                return json!({
                    "city_id": city.id,
                    "weather": Value::Null,
                    "error": "Keine aktuelle DWD-Beobachtung verfügbar."
                });
            }
            let sources = current
                .get("sources")
                .cloned()
                .unwrap_or_else(|| Value::Array(Vec::new()));
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
    .buffer_unordered(5)
    .collect::<Vec<Value>>()
    .await;

    Ok(tasks)
}

/// Search any place in Germany. Weather still comes from DWD via Bright Sky;
/// this endpoint is only used to turn a town name into coordinates.
#[tauri::command]
async fn search_places(app: tauri::AppHandle, query: String) -> Result<Value, String> {
    let query = query.trim();
    if query.chars().count() < 2 || query.chars().count() > 80 {
        return Ok(json!({ "results": [] }));
    }

    let key = query
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .take(80)
        .collect::<String>();
    let path = cache_path(&app, "places", &key);
    if let Some(cached) = path.as_ref().and_then(read_cache) {
        let age = cache_age(&cached);
        if (0..PLACE_CACHE_SECONDS).contains(&age) {
            return Ok(cached);
        }
    }

    let response = http()
        .get(GEOCODING)
        .query(&[
            ("name", query),
            ("count", "15"),
            ("language", "de"),
            ("format", "json"),
            ("countryCode", "DE"),
        ])
        .send()
        .await
        .map_err(|e| format!("Ortsuche nicht erreichbar: {e}"))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("Antwort der Ortsuche konnte nicht gelesen werden: {e}"))?;
    let parsed: Value =
        serde_json::from_str(&body).map_err(|e| format!("Ungültige Antwort der Ortsuche: {e}"))?;

    let raw = parsed
        .get("results")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut results: Vec<Value> = raw
        .into_iter()
        .filter(|place| {
            place
                .get("country_code")
                .and_then(Value::as_str)
                .map(|code| code == "DE")
                .unwrap_or(false)
        })
        .map(|place| {
            let geo_id = place.get("id").and_then(Value::as_i64).unwrap_or(0);
            let name = place
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let state = place
                .get("admin1")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .or_else(|| place.get("admin3").and_then(Value::as_str))
                .unwrap_or("Deutschland")
                .to_string();
            let lat = place.get("latitude").and_then(Value::as_f64).unwrap_or(0.0);
            let lon = place.get("longitude").and_then(Value::as_f64).unwrap_or(0.0);
            json!({
                "id": format!("ort-{geo_id}"),
                "name": name,
                "state": state,
                "lat": lat,
                "lon": lon,
                "population": place.get("population").and_then(Value::as_u64).unwrap_or(0),
                "kind": place.get("feature_code").and_then(Value::as_str).unwrap_or(""),
            })
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

/// Put the window on a secondary monitor when one is available. The primary
/// monitor is left untouched (e.g. for games or other fullscreen work).
fn place_on_secondary_monitor(window: &tauri::WebviewWindow) {
    let primary = window.primary_monitor().ok().flatten();
    let monitors = match window.available_monitors() {
        Ok(monitors) => monitors,
        Err(_) => return,
    };

    let target = monitors
        .iter()
        .find(|monitor| {
            primary
                .as_ref()
                .map(|primary| monitor.position() != primary.position())
                .unwrap_or(true)
        })
        .or_else(|| monitors.first());

    if let Some(monitor) = target {
        let area = monitor.work_area();
        let width = (1440).min(area.size.width.saturating_sub(48)).max(640);
        let height = (900).min(area.size.height.saturating_sub(80)).max(480);
        let x = area.position.x + ((area.size.width.saturating_sub(width)) / 2) as i32;
        let y = area.position.y + ((area.size.height.saturating_sub(height)) / 2) as i32;

        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        let _ = window.set_size(Size::Physical(PhysicalSize::new(width, height)));
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Keep the WebView surface fully opaque. WebKitGTK otherwise
            // composites translucent page layers against the desktop.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(7, 15, 23, 255)));
                place_on_secondary_monitor(&window);
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_weather,
            get_current_summaries,
            get_radar,
            search_places
        ])
        .run(tauri::generate_context!())
        .expect("error while running Brise");
}
