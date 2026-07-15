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
> view the sheet. Keep the link unlisted (don't post it publicly) and don't put
> anything private in the sheet. See [Privacy & location](#privacy--location).

## Sheet schema

One row per zman. The header row must contain exactly these column names:

| Column   | Required? | Purpose                                                          |
|----------|-----------|-------------------------------------------------------------------|
| `Day`    | Yes       | Section heading, e.g. `Erev Shabbos`, `Yom Tov Day 1`.            |
| `Zman`   | Yes       | e.g. `Candle Lighting`, `Mincha`, `Rebbi Davening for the Amud`.  |
| `Time`   | Yes       | Free text, e.g. `8:12 PM`. Shown exactly as typed.                |
| `Notes`  | Optional  | Small note under the row, e.g. `Followed by Kiddush`.             |
| `Icon`   | Optional  | Override the auto-picked icon for this row with any [Material Design Icon](https://pictogrammers.com/library/mdi/) name, e.g. `mdi:candle`. Leave blank to let the card choose. |
| `WeekTitle` | Optional | Fill in on just one row (e.g. the first). Shown as the card's title, e.g. `Parshas Balak`. Leave blank if you don't want a title. |

That's it — **no order columns to fill in.** The order you type rows in is
the order they're shown in: the first time a new `Day` value appears sets
that day's position, and rows are listed within a day in the order you typed
them. Just type top-to-bottom the same way you'd read the WhatsApp image.

**Rows for "the Rebbi is davening for the amud"** are just a normal row with
that as the `Zman` — the card automatically highlights any row whose name
contains "Rebbi". Just add the row on weeks it applies, and skip it on weeks
it doesn't.

A day's section on the dashboard is simply "every row that shares the same
`Day` text" — so 1-day weeks, 2-day Yom Tov, and 3-day Yom Tov (e.g. Friday
into a 2-day Yom Tov) all work automatically, with no configuration change.

### Example — a normal single-day Shabbos week

| Day          | Zman                        | Time    | Notes | WeekTitle     |
|--------------|-------------------------------|---------|-------|---------------|
| Erev Shabbos | Candle Lighting                | 8:12 PM |       | Parshas Balak |
| Erev Shabbos | Mincha / Kabbalas Shabbos       | 8:00 PM |       |               |
| Shabbos Day  | Shacharis                       | 9:00 AM |       |               |
| Shabbos Day  | Mincha                          | 7:45 PM |       |               |
| Shabbos Day  | Shabbos Ends                    | 9:15 PM |       |               |

### Example — 2-day Yom Tov, Rebbi davens only on Day 1

| Day           | Zman                          | Time    | Notes        | WeekTitle |
|---------------|--------------------------------|---------|--------------|-----------|
| Erev Yom Tov  | Candle Lighting                 | 8:15 PM |              | Shavuos   |
| Erev Yom Tov  | Mincha                          | 8:00 PM |              |           |
| Yom Tov Day 1 | Shacharis                       | 9:00 AM |              |           |
| Yom Tov Day 1 | Rebbi Davening for the Amud     |         | at Shacharis |           |
| Yom Tov Day 1 | Mincha                          | 7:50 PM |              |           |
| Yom Tov Day 2 | Shacharis                       | 9:00 AM |              |           |
| Yom Tov Day 2 | Mincha                          | 7:50 PM |              |           |
| Yom Tov Day 2 | Yom Tov Ends                    | 9:18 PM |              |           |

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
title: This Week's Zmanim   # optional title; by default only the sheet's WeekTitle shows
show_title: true            # set false to always hide the title/header
accent_color: "#c9a24a"     # color of icons + day labels + panel borders (default: theme accent)
show_icons: true            # set false to hide the per-row icons
icon_size: 18               # icon size in px (default 18)
show_notes: true            # set false to hide the Notes column
max_days: 3                 # cap how many day-sections are shown
default_icon: mdi:clock-time-four-outline  # icon for rows nothing else matches
highlight: rebbi            # comma-separated keywords to emphasize (see below)
```

The title/header only appears if the sheet has a `WeekTitle` (or you set
`title:`) — it never shows the entity name. Leave `WeekTitle` blank for a
clean, header-less card.

Each zman row automatically gets a fitting icon based on its name (candle for
candle-lighting, sunrise for shacharis, a book for kri'as shema, a star for
motzei shabbos, and so on — Hebrew and English). To force a specific icon on a
row, put an [MDI name](https://pictogrammers.com/library/mdi/) in that row's
`Icon` column in the sheet. Set `accent_color` to a warm gold like `#c9a24a`
for a traditional luach look, or leave it out to follow your Home Assistant
theme's accent color.

The card's custom element (`shul-zmanim-card.js`) is registered automatically
when the integration loads — you shouldn't need to add a Lovelace resource
manually.

### Hebrew / right-to-left

You can type your zman names and day labels in **Hebrew** — the card detects it
and renders right-to-left automatically (day sections flow right-to-left, and
each row shows the name on the right with the time on the left, the way the
printed luach reads). English stays left-to-right, and a sheet mixing both is
handled line by line. Times themselves always stay left-to-right so digits like
`8:07` read correctly.

### Highlighting a row (e.g. "Rebbi davening for the amud")

Any zman whose name contains a highlight keyword is emphasized (bold, accent
color). The default keyword is `rebbi`. To highlight Hebrew terms instead, set
your own comma-separated keywords:

```yaml
highlight: רבי,עמוד,rebbi
```

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
- **"Missing required columns"**: the header row must contain `Day`,
  `Zman`, and `Time` exactly as spelled in the
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

## Privacy & location

- **This repository contains no location, personal, or credential data.** The
  integration never reads your Home Assistant location (latitude/longitude/
  timezone) and stores nothing about where you are.
- Your Google Sheet URL is entered inside Home Assistant at setup time and kept
  in your local config — it is never committed to this repo or sent anywhere
  except to Google to fetch the sheet.
- The **only** thing that hints at your location is the zmanim *times* you type
  into the sheet (candle-lighting/shabbos-end times imply an approximate
  latitude and date). Those times live in your sheet and appear on your own
  dashboard — they are not published by this integration. Since the sheet is
  shared as "Anyone with the link", keep that link unlisted if you'd rather not
  have the times inferable by strangers. (For most shuls this schedule is
  posted publicly anyway, so this is usually a non-issue.)

## Roadmap

Automatic extraction of zmanim directly from a WhatsApp-style image, instead
of typing into the sheet by hand. Not yet built — still being designed.
Constraints gathered so far:

- **No Telegram**, and it can't depend on a specific person being logged into
  their own Home Assistant — this integration is meant for other people to
  use too, not just one person's personal setup. Likely direction: a generic
  webhook/URL endpoint the integration exposes, which any user could point
  their own phone's share-sheet automation at (e.g. iOS/Android Shortcuts),
  independent of any particular messaging app or account.
- **Possible alternative to full OCR-to-structured-data**: retain the actual
  image (cropped/cleaned of irrelevant parts) rather than converting
  everything to text — trades off against the card's resize/reflow
  flexibility, since an image doesn't reflow as cleanly as text. Worth
  weighing once this phase is picked back up.
- Needs a paid AI vision API key (e.g. Anthropic) to do the actual
  extraction — deferred until that's set up. Manual entry into the sheet
  remains the supported path until then.
