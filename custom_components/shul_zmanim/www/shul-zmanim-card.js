const ICON_RULES = [
  [/(הדלקת|נרות|candle)/i, "mdi:candle"],
  [/(קבלת שבת|kabbal)/i, "mdi:candle"],
  [/(עלות|alos|alot|dawn)/i, "mdi:weather-sunset-up"],
  [/(הנץ|נץ|sunrise|netz|hanetz)/i, "mdi:weather-sunny"],
  [/(שחרית|shachar)/i, "mdi:weather-sunset-up"],
  [/(קריאת שמע|קרי"ש|קרי|shema|shma|krias)/i, "mdi:book-open-variant"],
  [/(חצות|chatzos|chatzot)/i, "mdi:circle-half-full"],
  [/(מנחה|mincha|minchah)/i, "mdi:weather-sunset-down"],
  [/(שקיעה|shkia|shekia|sunset)/i, "mdi:weather-sunset"],
  [/(מעריב|ערבית|maariv|arvis|arvit)/i, "mdi:weather-night"],
  [/(מוצאי|motzei|motzoei|havdal|ends)/i, "mdi:star-david"],
  [/(סעוד|seuda|seudah|meal)/i, "mdi:silverware-fork-knife"],
  [/(שיעור|שיעורים|לימוד|תורה|torah|shiur|shiurim)/i, "mdi:book-open-page-variant"],
  [/(אסיפ|כינוס|התוועד|gather|farbreng)/i, "mdi:account-group"],
  [/(רבי|אדמו|admor|rebbe|rebbi)/i, "mdi:account-tie"],
  [/(אוהח|אור החיים|ohr|ohc)/i, "mdi:book-open-variant"],
  [/(שבת|shabbos|shabbat)/i, "mdi:star-david"],
];

// Optional Google fonts (all with good Hebrew coverage except Outfit).
const FONTS = {
  outfit: { family: "'Outfit', sans-serif", import: "family=Outfit:wght@500;600;700" },
  rubik: { family: "'Rubik', sans-serif", import: "family=Rubik:wght@500;600;700" },
  heebo: { family: "'Heebo', sans-serif", import: "family=Heebo:wght@500;600;700" },
  assistant: { family: "'Assistant', sans-serif", import: "family=Assistant:wght@500;600;700" },
};

class ShulZmanimCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You must define an entity");
    }
    this._config = config;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render(hass.states[this._config.entity]);
  }

  static getConfigElement() {
    return document.createElement("shul-zmanim-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.shul_zmanim" };
  }

  getLayoutOptions() {
    return { grid_columns: 3, grid_rows: "auto", grid_min_columns: 2 };
  }

  getCardSize() {
    if (!this._lastSections) {
      return 3;
    }
    const totalRows = this._lastSections.reduce(
      (sum, day) => sum + (day.zmanim || []).length,
      0
    );
    return Math.max(2, Math.ceil((this._lastSections.length * 2 + totalRows) / 3));
  }

  _fontKey() {
    return this._config.font || (this._config.preset === "amber" ? "outfit" : "");
  }

  _render(stateObj) {
    const root = this.shadowRoot;
    const cardClass = this._config.preset === "amber" ? "amber" : "";

    if (!stateObj) {
      this._lastSections = null;
      root.innerHTML = `
        ${this._style()}
        <ha-card class="${cardClass}"><div class="empty">Entity not found: ${this._escape(this._config.entity)}</div></ha-card>
      `;
      return;
    }

    const title = this._config.title || stateObj.attributes.week_title || "";
    const showTitle = this._config.show_title !== false;
    const allDays = stateObj.attributes.days || [];
    const maxDays = this._config.max_days;
    const days = typeof maxDays === "number" ? allDays.slice(0, maxDays) : allDays;
    const sections = days.filter((day) => (day.zmanim || []).length > 0);
    this._lastSections = sections;

    const dir = this._overallDir(sections);
    const accent =
      this._config.accent_color ||
      (cardClass === "amber" ? "#ffb74d" : "var(--primary-color)");
    const iconSize = Number(this._config.icon_size) || 16;

    const fontKey = this._fontKey();
    const fontFamily = FONTS[fontKey] ? FONTS[fontKey].family : "";
    const fontSize = Number(this._config.font_size) || 0;

    // Per-element bold toggles and row spacing (all editable in the UI).
    const fwHeader = (this._config.bold_header ?? true) ? "700" : "500";
    const fwName = (this._config.bold_name ?? false) ? "700" : "500";
    const fwTime = (this._config.bold_time ?? true) ? "700" : "400";
    const fwNotes = (this._config.bold_notes ?? false) ? "700" : "400";
    const rowPad = Number.isFinite(Number(this._config.row_spacing))
      ? Number(this._config.row_spacing)
      : 3;

    let wrapStyle =
      `--accent:${this._escape(accent)};--isize:${iconSize}px` +
      `;--fw-header:${fwHeader};--fw-name:${fwName};--fw-time:${fwTime}` +
      `;--fw-notes:${fwNotes};--rowpad:${rowPad}px`;
    if (fontFamily) wrapStyle += `;font-family:${fontFamily}`;
    if (fontSize) wrapStyle += `;font-size:${fontSize}px`;

    const header =
      showTitle && title
        ? `<div class="card-header" dir="auto">${this._escape(title)}</div>` +
          `<div class="rule" aria-hidden="true"><i class="gem"></i></div>`
        : "";

    const inner =
      sections.length === 0
        ? `<div class="empty">No zmanim posted yet this week.</div>`
        : `<div class="days">${sections.map((d) => this._renderDay(d)).join("")}</div>`;

    root.innerHTML = `
      ${this._style()}
      <ha-card class="${cardClass}">
        <div class="wrap" dir="${dir}" style="${wrapStyle}">
          ${header}
          ${inner}
        </div>
      </ha-card>
    `;
  }

  _renderDay(day) {
    const rows = (day.zmanim || []).map((z) => this._renderRow(z)).join("");
    const label = day.day_label
      ? `<div class="day-label" dir="auto">${this._escape(day.day_label)}</div>`
      : "";
    return `<section class="day">${label}<div class="entries">${rows}</div></section>`;
  }

  _renderRow(zman) {
    const highlight = this._isHighlighted(zman.name || "");
    const showNotes = this._config.show_notes !== false;
    const showIcons = this._config.show_icons !== false;

    const iconName = showIcons ? this._iconFor(zman) : "";
    const icon = iconName
      ? `<ha-icon class="zman-icon" icon="${this._escape(iconName)}"></ha-icon>`
      : "";
    const time = zman.time
      ? `<span class="time" dir="ltr">${this._escape(zman.time)}</span>`
      : "";
    const notes =
      showNotes && zman.notes
        ? `<span class="notes" dir="auto">${this._escape(zman.notes)}</span>`
        : "";

    return `
      <div class="entry${highlight ? " highlight" : ""}">
        ${icon}
        <div class="text">
          <span class="name" dir="auto">${this._escape(zman.name || "")}</span>
          ${notes}
        </div>
        ${time}
      </div>
    `;
  }

  _iconFor(zman) {
    if (zman.icon) {
      return zman.icon;
    }
    const name = zman.name || "";
    for (const [re, icon] of ICON_RULES) {
      if (re.test(name)) {
        return icon;
      }
    }
    return this._config.default_icon || "mdi:clock-time-four-outline";
  }

  _overallDir(sections) {
    const hebrew = /[֐-׿]/;
    const hasHebrew = sections.some(
      (day) =>
        hebrew.test(day.day_label || "") ||
        (day.zmanim || []).some((z) => hebrew.test(z.name || ""))
    );
    return hasHebrew ? "rtl" : "ltr";
  }

  _isHighlighted(name) {
    const raw = this._config.highlight ?? "rebbi";
    const keywords = String(raw).split(",").map((k) => k.trim()).filter(Boolean);
    return keywords.some((k) => name.toLowerCase().includes(k.toLowerCase()));
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _style() {
    const fontKey = this._fontKey();
    const fontImport = FONTS[fontKey]
      ? `@import url('https://fonts.googleapis.com/css2?${FONTS[fontKey].import}&display=swap');`
      : "";
    return `
      <style>
        ${fontImport}
        ha-card {
          container-type: inline-size;
          container-name: zmanim;
          overflow: hidden;
          position: relative;
        }

        /* "amber" preset: warm dark luach look with a glowing gold top line. */
        ha-card.amber {
          background: linear-gradient(160deg, rgba(44, 36, 24, 0.94), rgba(20, 18, 16, 0.97));
          border: 1px solid rgba(255, 183, 77, 0.18);
          border-radius: 22px;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          --primary-text-color: #f0ebe0;
          --secondary-text-color: rgba(240, 235, 224, 0.62);
          --divider-color: rgba(255, 183, 77, 0.14);
        }
        ha-card.amber::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255, 183, 77, 0.85), transparent);
        }

        .wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 10px 11px;
          font-size: 1rem;
        }
        .empty {
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          padding: 6px 0;
        }

        /* Title + slim divider with a centered diamond. */
        .card-header {
          text-align: center;
          font-size: 1.2em;
          font-weight: var(--fw-header, 700);
          line-height: 1.15;
          letter-spacing: 0.01em;
          color: var(--primary-text-color);
          overflow-wrap: anywhere;
        }
        .rule {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .rule::before,
        .rule::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 60%, transparent));
        }
        .rule::after {
          background: linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 60%, transparent));
        }
        .gem {
          flex: 0 0 auto;
          width: 6px;
          height: 6px;
          transform: rotate(45deg);
          background: var(--accent);
        }

        .days {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .day {
          border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
          border-radius: 12px;
          padding: 6px 10px 3px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--accent) 10%, transparent),
            color-mix(in srgb, var(--accent) 3%, transparent)
          );
        }
        .day-label {
          text-align: center;
          font-size: 0.92em;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--accent);
          margin-bottom: 3px;
          padding-bottom: 3px;
          border-bottom: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          overflow-wrap: anywhere;
        }

        .entries { display: flex; flex-direction: column; }
        .entry {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: var(--rowpad, 3px) 2px;
          border-radius: 8px;
          line-height: 1.15;
        }
        .entry + .entry {
          border-top: 1px solid color-mix(in srgb, var(--divider-color) 40%, transparent);
        }

        .zman-icon {
          flex: 0 0 auto;
          color: var(--accent);
          --mdc-icon-color: var(--accent);
          width: var(--isize);
          height: var(--isize);
        }
        .text {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .name {
          font-size: 0.92em;
          font-weight: var(--fw-name, 500);
          color: var(--primary-text-color);
          overflow-wrap: anywhere;
        }
        .notes {
          font-size: 0.72em;
          font-weight: var(--fw-notes, 400);
          color: var(--secondary-text-color);
          overflow-wrap: anywhere;
        }
        .time {
          flex-shrink: 0;
          font-size: 0.96em;
          font-weight: var(--fw-time, 700);
          color: var(--primary-text-color);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .entry.highlight {
          background: color-mix(in srgb, var(--accent) 16%, transparent);
        }
        .entry.highlight .name,
        .entry.highlight .time {
          color: var(--accent);
          font-weight: 700;
        }

        @container zmanim (max-width: 290px) {
          .card-header { font-size: 1.08em; }
          .day-label { font-size: 0.86em; }
          .name { font-size: 0.86em; }
          .time { font-size: 0.9em; }
          .notes { font-size: 0.68em; }
          .entry { gap: 7px; }
        }
      </style>
    `;
  }
}

customElements.define("shul-zmanim-card", ShulZmanimCard);

// --- Visual (UI) editor -----------------------------------------------------

const EDITOR_LABELS = {
  entity: "Entity",
  title: "Title (optional)",
  preset: "Color style",
  accent_color: "Accent color (hex or blank)",
  font: "Font",
  font_size: "Font size",
  icon_size: "Icon size",
  max_days: "Max days shown (optional)",
  row_spacing: "Row spacing",
  highlight: "Highlight keywords",
  show_title: "Show title",
  show_icons: "Show icons",
  show_notes: "Show notes",
  bold_header: "Bold title",
  bold_name: "Bold names",
  bold_time: "Bold times",
  bold_notes: "Bold notes",
};

class ShulZmanimCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    return [
      { name: "entity", selector: { entity: { domain: "sensor" } } },
      { name: "title", selector: { text: {} } },
      {
        name: "preset",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "", label: "Follow HA theme" },
              { value: "amber", label: "Amber (warm dark)" },
            ],
          },
        },
      },
      { name: "accent_color", selector: { text: {} } },
      {
        name: "font",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "", label: "Default" },
              { value: "outfit", label: "Outfit" },
              { value: "rubik", label: "Rubik" },
              { value: "heebo", label: "Heebo" },
              { value: "assistant", label: "Assistant" },
            ],
          },
        },
      },
      {
        name: "font_size",
        selector: { number: { min: 10, max: 28, step: 1, mode: "slider", unit_of_measurement: "px" } },
      },
      {
        name: "icon_size",
        selector: { number: { min: 10, max: 40, step: 1, mode: "slider", unit_of_measurement: "px" } },
      },
      {
        name: "max_days",
        selector: { number: { min: 1, max: 10, step: 1, mode: "box" } },
      },
      {
        name: "row_spacing",
        selector: { number: { min: 0, max: 20, step: 1, mode: "slider", unit_of_measurement: "px" } },
      },
      { name: "highlight", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "show_title", selector: { boolean: {} } },
          { name: "show_icons", selector: { boolean: {} } },
          { name: "show_notes", selector: { boolean: {} } },
          { name: "bold_header", selector: { boolean: {} } },
          { name: "bold_name", selector: { boolean: {} } },
          { name: "bold_time", selector: { boolean: {} } },
          { name: "bold_notes", selector: { boolean: {} } },
        ],
      },
    ];
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
      this.appendChild(this._form);
    }
    // Defaults so the boolean switches show a sensible state.
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = {
      show_title: true,
      show_icons: true,
      show_notes: true,
      bold_header: true,
      bold_name: false,
      bold_time: true,
      bold_notes: false,
      font_size: 16,
      icon_size: 16,
      row_spacing: 3,
      ...this._config,
    };
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const config = { ...ev.detail.value };
    // Drop empties so the config stays clean.
    for (const key of Object.keys(config)) {
      if (config[key] === "" || config[key] === undefined || config[key] === null) {
        delete config[key];
      }
    }
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
    );
  }
}

customElements.define("shul-zmanim-card-editor", ShulZmanimCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "shul-zmanim-card",
  name: "Shul Zmanim",
  description: "Displays this week's shul zmanim grouped by day.",
  preview: true,
  documentationURL: "https://github.com/yb460/custom-zmanim-ha-dashboard",
});
