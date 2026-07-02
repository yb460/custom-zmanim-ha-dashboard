# Shul Zmanim

A Home Assistant custom integration + dashboard card that pulls this week's shul
zmanim (candle lighting, mincha, shacharis, Yom Tov schedules, etc.) from a
Google Sheet and displays them cleanly on your dashboard — grouped by day,
with sections that automatically appear or disappear depending on how many
days you have that week.

You keep typing the week's zmanim into the Google Sheet, same as before.
Everything else — pulling the data, grouping it by day, rendering it nicely —
is handled for you.

## Installation (HACS)

1. In Home Assistant, open **HACS**.
2. Click the **⋮** menu (top right) → **Custom repositories**.
3. Paste this repository's URL, choose category **Integration**, and click **Add**.
4. Find **Shul Zmanim** in HACS and click **Install**.
5. **Restart Home Assistant.**
6. Go to **Settings → Devices & Services → Add Integration**, search for
   **Shul Zmanim**, and follow the setup steps below.

Future updates: bump releases will simply show up as an "Update" in HACS,
same as any other HACS integration — no manual file copying.

## Setting up your Google Sheet

1. Create a Google Sheet (or use your existing one) with a tab containing the
   columns described in [Sheet schema](#sheet-schema) below.
2. Click **Share** (top right of the sheet) → set **General access** to
   **Anyone with the link** → **Viewer**. (No Google Cloud account, API key,
   or credentials needed — the integration just reads a public CSV export of
   the sheet.)
3. With the correct tab open, look at your browser's address bar. You'll see
   something like:
   `https://docs.google.com/spreadsheets/d/1AbCDeFGhijklmnop/edit#gid=123456789`
4. Copy that whole URL.
5. In the Shul Zmanim setup screen in Home Assistant, paste it into
   **Google Sheet URL**. The integration figures out the rest.

That's it — no "Publish to web" step needed, and edits to the sheet show up
within your configured poll interval (60 minutes by default, changeable from
the integration's **Configure** button in Home Assistant).

> **Privacy note:** "Anyone with the link" means anyone who has the link can
> view the sheet. This is fine for zmanim times (nothing sensitive), but
> don't put anything private in this sheet.

## Sheet schema

One row per zman. The header row must contain exactly these column names:

| Column      | Purpose                                                                 |
|-------------|--------------------------------------------------------------------------|
| `WeekTitle` | Repeated on every row. Shown as the card's title, e.g. `Parshas Balak`. |
| `DayOrder`  | Number controlling day order: `0` = Erev, `1` = Day 1, `2` = Day 2...   |
| `DayLabel`  | Section heading shown on the card, e.g. `Erev Shabbos`, `Yom Tov Day 1`. |
| `ZmanOrder` | Number controlling row order within a day (rows can be typed in any order). |
| `ZmanName`  | e.g. `Candle Lighting`, `Mincha`, `Rebbi Davening for the Amud`.        |
| `Time`      | Free text, e.g. `8:12 PM`. Shown exactly as typed.                     |
| `Notes`     | Optional small note under the row, e.g. `Followed by Kiddush`.         |

**Rows for "the Rebbi is davening for the amud"** are just a normal row with
that as the `ZmanName` — the card automatically highlights any row whose name
contains "Rebbi". Just add the row on weeks it applies, and skip it on weeks
it doesn't.

A day's section on the dashboard is simply "every row that shares the same
`DayOrder`" — so 1-day weeks, 2-day Yom Tov, and 3-day Yom Tov (e.g. Friday
into a 2-day Yom Tov) all work automatically, with no configuration change.

### Example — a normal single-day Shabbos week

| WeekTitle     | DayOrder | DayLabel      | ZmanOrder | ZmanName                    | Time    | Notes |
|---------------|----------|---------------|-----------|------------------------------|---------|-------|
| Parshas Balak | 0        | Erev Shabbos  | 1         | Candle Lighting              | 8:12 PM |       |
| Parshas Balak | 0        | Erev Shabbos  | 2         | Mincha / Kabbalas Shabbos    | 8:00 PM |       |
| Parshas Balak | 1        | Shabbos Day   | 1         | Shacharis                    | 9:00 AM |       |
| Parshas Balak | 1        | Shabbos Day   | 2         | Mincha                       | 7:45 PM |       |
| Parshas Balak | 1        | Shabbos Day   | 3         | Shabbos Ends                 | 9:15 PM |       |

### Example — 2-day Yom Tov, Rebbi davens only on Day 1

| WeekTitle | DayOrder | DayLabel      | ZmanOrder | ZmanName                     | Time    | Notes         |
|-----------|----------|---------------|-----------|-------------------------------|---------|---------------|
| Shavuos   | 0        | Erev Yom Tov  | 1         | Candle Lighting                | 8:15 PM |               |
| Shavuos   | 0        | Erev Yom Tov  | 2         | Mincha                         | 8:00 PM |               |
| Shavuos   | 1        | Yom Tov Day 1 | 1         | Shacharis                      | 9:00 AM |               |
| Shavuos   | 1        | Yom Tov Day 1 | 2         | Rebbi Davening for the Amud    |         | at Shacharis  |
| Shavuos   | 1        | Yom Tov Day 1 | 3         | Mincha                         | 7:50 PM |               |
| Shavuos   | 2        | Yom Tov Day 2 | 1         | Shacharis                      | 9:00 AM |               |
| Shavuos   | 2        | Yom Tov Day 2 | 2         | Mincha                         | 7:50 PM |               |
| Shavuos   | 2        | Yom Tov Day 2 | 3         | Yom Tov Ends                   | 9:18 PM |               |

## Adding the card to your dashboard

The integration creates one sensor, `sensor.shul_zmanim` (the entity ID may
differ if you name it something else during setup). Edit your dashboard, add
a card, and use:

```yaml
type: custom:shul-zmanim-card
entity: sensor.shul_zmanim
```

Optional card settings:

```yaml
type: custom:shul-zmanim-card
entity: sensor.shul_zmanim
title: This Week's Zmanim   # overrides the WeekTitle from the sheet
max_days: 3                 # cap how many day-sections are shown
show_notes: true            # set false to hide the Notes column
```

The card's custom element (`shul-zmanim-card.js`) is registered automatically
when the integration loads — you shouldn't need to add a Lovelace resource
manually.

## Updating the sheet each week

Just edit the same sheet/tab you set up above — replace the rows with the
new week's zmanim (or clear and retype). The integration polls automatically
(default every 60 minutes), or you can force an immediate refresh by pressing
the **Refresh Now** button entity the integration creates, right after you
finish typing.

## Troubleshooting

- **Card doesn't render / "custom element doesn't exist"**: The integration
  should register the card automatically. If it doesn't (e.g. after a
  frontend cache issue), go to **Settings → Dashboards → Resources → Add
  Resource**, and add `/shul_zmanim/frontend/shul-zmanim-card.js` as a
  **JavaScript Module**, then reload the dashboard.
- **"Couldn't reach the sheet" during setup**: double-check the sheet is
  shared as "Anyone with the link → Viewer", not restricted.
- **"Missing required columns"**: the header row must contain `DayOrder`,
  `DayLabel`, `ZmanName`, and `Time` exactly as spelled in the
  [Sheet schema](#sheet-schema) section.
- **Reduce database size**: this entity's state changes weekly and has no
  useful history, so it's worth excluding from the recorder in your
  `configuration.yaml`:

  ```yaml
  recorder:
    exclude:
      entities:
        - sensor.shul_zmanim
  ```

## Roadmap

- Automatic extraction of zmanim directly from the WhatsApp image (AI-based),
  writing into the same sheet schema — no changes to this integration or
  card will be needed when that ships, since both only ever read the sheet.
