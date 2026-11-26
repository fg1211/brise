# Hinweise zu Drittanbietern

Brise verwendet folgende Daten und Software von Dritten:

| Inhalt | Quelle | Lizenz / Hinweis |
| --- | --- | --- |
| Wetterbeobachtungen, Vorhersagen, Warnungen, Radar | [Deutscher Wetterdienst](https://www.dwd.de/), vermittelt über [Bright Sky](https://api.brightsky.dev/) | DWD Open Data; Datenquelle muss genannt werden |
| Ortsuche (Namensauflösung) | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), basierend auf [GeoNames](https://www.geonames.org/) | GeoNames-Daten unter CC BY 4.0; Namensnennung erforderlich |
| Grenzverlauf Deutschland / Bundesländer | [Natural Earth](https://www.naturalearthdata.com/) | Gemeinfrei (Public Domain) |
| Schrift „Inter“ | [Inter](https://rsms.me/inter/) | SIL Open Font License 1.1 |
| Schrift „Space Grotesk“ | [Space Grotesk](https://floriankarsten.com/space-grotesk/) | SIL Open Font License 1.1 |
| Symbole in der Oberfläche | [Lucide](https://lucide.dev/), lokal unter `ui/icons/` | ISC-Lizenz |
| Rust-/Tauri-Abhängigkeiten | siehe `src-tauri/Cargo.lock` | jeweilige Open-Source-Lizenzen |

Brise ist ein unabhängiges Projekt und ist nicht mit dem Deutschen Wetterdienst
verbunden. Wetterdaten, Warnungen und Radar stammen ausschließlich vom DWD;
Open-Meteo/GeoNames werden nur für die Suche nach Ortsnamen verwendet.
