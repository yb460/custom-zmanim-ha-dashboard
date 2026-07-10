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

  // Portrait footprint on HA "sections" dashboards: narrow columns, height
  // sized to the content (some weeks are short, Yom Tov weeks are tall).
  getLayoutOptions() {
    return {
      grid_columns: 3,
      grid_rows: "auto",
      grid_min_columns: 2,
    };
  }

  // Rough size hint for masonry-view dashboards, scaled to how much content
  // is actually being shown this week (1 day vs. 3 days of Yom Tov).
  getCardSize() {
    if (!this._lastSections) {
      return 4;
    }
    const totalRows = this._lastSections.reduce(
      (sum, day) => sum + (day.zmanim || []).length,
      0
    );
    return Math.max(3, 1 + this._lastSections.length + Math.ceil(totalRows / 2));
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
        <ha-card>
          <div class="empty">Entity not found: ${this._escape(this._config.entity)}</div>
        </ha-card>
      `;
      return;
    }

    const title =
      this._config.title || stateObj.attributes.week_title ||
      stateObj.attributes.friendly_name || stateObj.state;
    const allDays = stateObj.attributes.days || [];
    const maxDays = this._config.max_days;
    const days = typeof maxDays === "number" ? allDays.slice(0, maxDays) : allDays;
    const showNotes = this._config.show_notes !== false;
    const sections = days.filter((day) => (day.zmanim || []).length > 0);
    this._lastSections = sections;

    const dir = this._overallDir(sections);

    if (sections.length === 0) {
      root.innerHTML = `
        ${this._style()}
        <ha-card>
          <div class="wrap" dir="${dir}">
            ${title ? `<div class="card-header" dir="auto">${this._escape(title)}</div>` : ""}
            <div class="empty">No zmanim posted yet this week.</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const body = sections.map((day) => this._renderDay(day, showNotes)).join("");

    root.innerHTML = `
      ${this._style()}
      <ha-card>
        <div class="wrap" dir="${dir}">
          ${title ? `<div class="card-header" dir="auto">${this._escape(title)}</div>` : ""}
          <div class="days">${body}</div>
        </div>
      </ha-card>
    `;
  }

  _renderDay(day, showNotes) {
    const rows = (day.zmanim || []).map((z) => this._renderRow(z, showNotes)).join("");
    const label = day.day_label
      ? `<div class="day-label" dir="auto"><span>${this._escape(day.day_label)}</span></div>`
      : "";
    return `
      <section class="day">
        ${label}
        <div class="entries">${rows}</div>
      </section>
    `;
  }

  _renderRow(zman, showNotes) {
    const highlight = this._isHighlighted(zman.name || "");
    const time = zman.time
      ? `<span class="time" dir="ltr">${this._escape(zman.time)}</span>`
      : "";
    const notes =
      showNotes && zman.notes
        ? `<div class="notes" dir="auto">${this._escape(zman.notes)}</div>`
        : "";
    return `
      <div class="entry${highlight ? " highlight" : ""}">
        <div class="row">
          <span class="name" dir="auto">${this._escape(zman.name || "")}</span>
          <span class="leader" aria-hidden="true"></span>
          ${time}
        </div>
        ${notes}
      </div>
    `;
  }

  _overallDir(sections) {
    // Right-to-left if any day label or zman name contains a Hebrew character.
    const hebrew = /[֐-׿]/;
    const hasHebrew = sections.some(
      (day) =>
        hebrew.test(day.day_label || "") ||
        (day.zmanim || []).some((z) => hebrew.test(z.name || ""))
    );
    return hasHebrew ? "rtl" : "ltr";
  }

  _isHighlighted(name) {
    // Comma-separated keywords; a zman whose name contains any of them is
    // emphasized. Defaults to "rebbi"; set `highlight:` for Hebrew/other terms.
    const raw = this._config.highlight ?? "rebbi";
    const keywords = String(raw)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return keywords.some((k) => name.toLowerCase().includes(k.toLowerCase()));
  }

  _escape(value) {
    // Safe for element-content AND attribute contexts (title goes into markup).
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
          gap: 20px;
          padding: 20px 18px 22px;
        }
        .empty {
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          padding: 8px 0;
        }

        .card-header {
          text-align: center;
          font-size: 1.55rem;
          font-weight: 700;
          line-height: 1.2;
          color: var(--primary-text-color);
          padding-bottom: 14px;
          border-bottom: 3px double var(--divider-color);
          overflow-wrap: anywhere;
        }

        .days {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* Day heading centered between two rules, like a section divider. */
        .day-label {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .day-label::before,
        .day-label::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--divider-color);
        }
        .day-label span {
          font-size: 1.12rem;
          font-weight: 700;
          color: var(--primary-color);
          white-space: nowrap;
          overflow-wrap: anywhere;
        }

        .entries {
          display: flex;
          flex-direction: column;
        }
        .entry {
          padding: 7px 8px;
          border-radius: 10px;
        }
        .row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .name {
          font-size: 1.02rem;
          font-weight: 500;
          color: var(--primary-text-color);
          overflow-wrap: anywhere;
        }
        /* Dotted leader connecting the name to the time (luach style). */
        .leader {
          flex: 1 1 auto;
          min-width: 14px;
          align-self: flex-end;
          transform: translateY(-4px);
          border-bottom: 2px dotted var(--divider-color);
        }
        .time {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--primary-text-color);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .notes {
          font-size: 0.82rem;
          color: var(--secondary-text-color);
          margin-top: 1px;
          overflow-wrap: anywhere;
        }

        /* Emphasize a highlighted row (e.g. "Rebbi davening for the amud"). */
        .entry.highlight {
          background: color-mix(in srgb, var(--primary-color) 12%, transparent);
        }
        .entry.highlight .name,
        .entry.highlight .time {
          color: var(--primary-color);
          font-weight: 700;
        }
        .entry.highlight .leader {
          border-bottom-color: color-mix(in srgb, var(--primary-color) 45%, transparent);
        }

        /* Tighten up on very narrow cards so nothing feels cramped. */
        @container zmanim (max-width: 300px) {
          .wrap { padding: 16px 14px 18px; gap: 16px; }
          .card-header { font-size: 1.35rem; }
          .day-label span { font-size: 1.02rem; }
          .name, .time { font-size: 0.96rem; }
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
