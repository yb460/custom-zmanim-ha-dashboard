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

  // Lets HA's grid/"sections" dashboards offer resizing this card, with
  // sensible defaults and a reasonable minimum so text stays readable.
  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_rows: 4,
      grid_min_columns: 2,
      grid_min_rows: 2,
    };
  }

  // Rough size hint for masonry-view dashboards, scaled to how much content
  // is actually being shown this week (1 day vs. 3 days of Yom Tov).
  getCardSize() {
    if (!this._lastSections) {
      return 3;
    }
    const totalRows = this._lastSections.reduce(
      (sum, day) => sum + (day.zmanim || []).length,
      0
    );
    return Math.max(2, 1 + Math.ceil((this._lastSections.length + totalRows) / 3));
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

    const title = this._config.title || stateObj.attributes.friendly_name || stateObj.state;
    const allDays = stateObj.attributes.days || [];
    const maxDays = this._config.max_days;
    const days = typeof maxDays === "number" ? allDays.slice(0, maxDays) : allDays;
    const showNotes = this._config.show_notes !== false;
    const sections = days.filter((day) => (day.zmanim || []).length > 0);
    this._lastSections = sections;

    if (sections.length === 0) {
      root.innerHTML = `
        ${this._style()}
        <ha-card header="${this._escape(title)}">
          <div class="empty">No zmanim posted yet this week.</div>
        </ha-card>
      `;
      return;
    }

    const content = sections.map((day) => this._renderDay(day, showNotes)).join("");

    root.innerHTML = `
      ${this._style()}
      <ha-card header="${this._escape(title)}">
        <div class="content">${content}</div>
      </ha-card>
    `;
  }

  _renderDay(day, showNotes) {
    const rows = (day.zmanim || []).map((z) => this._renderRow(z, showNotes)).join("");
    return `
      <div class="day">
        <div class="day-label">${this._escape(day.day_label || "")}</div>
        <div class="rows">${rows}</div>
      </div>
    `;
  }

  _renderRow(zman, showNotes) {
    const highlight = /rebbi/i.test(zman.name || "");
    const notes =
      showNotes && zman.notes ? `<div class="notes">${this._escape(zman.notes)}</div>` : "";
    return `
      <div class="row${highlight ? " highlight" : ""}">
        <div class="name-wrap">
          <span class="name">${this._escape(zman.name || "")}</span>
          ${notes}
        </div>
        <span class="time">${this._escape(zman.time || "")}</span>
      </div>
    `;
  }

  _escape(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  _style() {
    return `
      <style>
        ha-card {
          container-type: inline-size;
          container-name: shul-zmanim-card;
        }
        .content {
          display: grid;
          /* Day sections lay themselves out in as many columns as fit -
             wide/resized cards show days side-by-side, narrow cards stack
             to a single column. No JS/ResizeObserver needed. */
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px 24px;
          padding: 0 16px 16px;
          align-items: start;
        }
        .empty {
          padding: 16px;
          color: var(--secondary-text-color);
          font-style: italic;
        }
        .day-label {
          font-weight: 600;
          font-size: 1.05rem;
          color: var(--primary-text-color);
          border-bottom: 1px solid var(--divider-color);
          padding-bottom: 4px;
          margin-bottom: 6px;
          overflow-wrap: anywhere;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          padding: 5px 0;
          font-size: 0.95rem;
        }
        .row.highlight .name {
          color: var(--primary-color);
          font-weight: 600;
        }
        .name-wrap {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .name {
          color: var(--primary-text-color);
          overflow-wrap: anywhere;
        }
        .notes {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          overflow-wrap: anywhere;
        }
        .time {
          color: var(--primary-text-color);
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        /* When the card is resized very narrow (e.g. a small grid cell),
           tighten spacing and font size a bit so text still fits cleanly
           instead of wrapping awkwardly. */
        @container shul-zmanim-card (max-width: 320px) {
          .content {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 0 12px 12px;
          }
          .day-label {
            font-size: 0.95rem;
          }
          .row {
            font-size: 0.88rem;
          }
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
