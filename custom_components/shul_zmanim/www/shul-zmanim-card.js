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

  // Portrait footprint on HA "sections" dashboards: narrow, height fits content.
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

  static getStubConfig() {
    return { entity: "sensor.shul_zmanim" };
  }

  _render(stateObj) {
    const root = this.shadowRoot;

    if (!stateObj) {
      this._lastSections = null;
      root.innerHTML = `
        ${this._style()}
        <ha-card><div class="empty">Entity not found: ${this._escape(this._config.entity)}</div></ha-card>
      `;
      return;
    }

    // Only a real title from the sheet (WeekTitle) or config shows - never the
    // entity name. Set `title:` to force one, or `show_title: false` to hide.
    const title = this._config.title || stateObj.attributes.week_title || "";
    const showTitle = this._config.show_title !== false;
    const allDays = stateObj.attributes.days || [];
    const maxDays = this._config.max_days;
    const days = typeof maxDays === "number" ? allDays.slice(0, maxDays) : allDays;
    const sections = days.filter((day) => (day.zmanim || []).length > 0);
    this._lastSections = sections;

    const dir = this._overallDir(sections);
    const accent = this._config.accent_color || "var(--primary-color)";
    const iconSize = Number(this._config.icon_size) || 16;
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
      <ha-card>
        <div class="wrap" dir="${dir}" style="--accent:${this._escape(accent)};--isize:${iconSize}px">
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
      return zman.icon; // explicit override from the sheet's Icon column
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
    return `
      <style>
        ha-card {
          container-type: inline-size;
          container-name: zmanim;
          overflow: hidden;
        }
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 10px 11px;
        }
        .empty {
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          padding: 6px 0;
        }

        /* Title + slim gold divider with a centered diamond. */
        .card-header {
          text-align: center;
          font-size: 1.2rem;
          font-weight: 700;
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
          background: linear-gradient(
            to right, transparent,
            color-mix(in srgb, var(--accent) 60%, transparent)
          );
        }
        .rule::after {
          background: linear-gradient(
            to left, transparent,
            color-mix(in srgb, var(--accent) 60%, transparent)
          );
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

        /* Rounded panel per day, compact. */
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
          font-size: 0.92rem;
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
          padding: 3px 2px;
          border-radius: 8px;
          line-height: 1.15;
        }
        .entry + .entry {
          border-top: 1px solid color-mix(in srgb, var(--divider-color) 40%, transparent);
        }

        /* Clean gold icon, no heavy badge. */
        .zman-icon {
          flex: 0 0 auto;
          color: var(--accent);
          --mdc-icon-color: var(--accent);
          --mdc-icon-size: var(--isize);
          width: var(--isize);
          height: var(--isize);
          line-height: var(--isize);
        }
        .text {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .name {
          font-size: 0.92rem;
          font-weight: 500;
          color: var(--primary-text-color);
          overflow-wrap: anywhere;
        }
        .notes {
          font-size: 0.72rem;
          color: var(--secondary-text-color);
          overflow-wrap: anywhere;
        }
        .time {
          flex-shrink: 0;
          font-size: 0.96rem;
          font-weight: 700;
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
          .card-header { font-size: 1.08rem; }
          .day-label { font-size: 0.86rem; }
          .name { font-size: 0.86rem; }
          .time { font-size: 0.9rem; }
          .notes { font-size: 0.68rem; }
          .entry { gap: 7px; }
        }
      </style>
    `;
  }
}

customElements.define("shul-zmanim-card", ShulZmanimCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "shul-zmanim-card",
  name: "Shul Zmanim",
  description: "Displays this week's shul zmanim grouped by day.",
});
