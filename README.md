# Seed Sprouter

An iPhone-first Expo app for mapping planted rows over a garden photo, keeping crop timelines and seed-packet photos, receiving stage-aware watering reminders, comparing progress photos, and retaining a bed's history across harvest/replant cycles.

## What is included

- Multiple garden beds, stored locally on the device with SQLite
- A new planting cycle for every harvest/replant, without losing old photos or row records
- Camera or photo-library capture for beds, seed packets and progress updates
- Full-screen, story-style photo editor with pinch-to-zoom, pan, draggable typed labels, colour tools and finger-drawn planting outlines
- Newcastle, NSW five-day weather from Open-Meteo (no API key for non-commercial use)
- Independent per-bed reminders with configurable weekdays and any number of daily times; wording changes with the growth stage
- A bundled garden-staples guide covering common vegetables, herbs, alliums, roots, brassicas and companion plants
- Distinct home-screen icons for development (`DEV`), preview (`PRE`) and production builds
- Separate front and back photos for every seed packet
- Onion-skin progress camera using the previous photo and mapped outlines for repeatable alignment
- Option to promote an aligned progress photo to the bed's current image while retaining its labels and outlines

The crop guide is general guidance for Newcastle's temperate coastal climate. Variety, soil and microclimate matter; the seed packet should take priority.

## Run on an iPhone from Windows (development build)

An iPhone development build produced from Windows is compiled in Expo's EAS cloud. A physical iPhone build requires an Expo account, an active Apple Developer Program membership, and Developer Mode on the phone (iOS 16+).

1. Install Node.js LTS and EAS CLI on the PC:

   ```powershell
   npm install --global eas-cli
   ```

2. From this `garden-bed` folder, sign in and register the iPhone:

   ```powershell
   eas login
   eas device:create
   ```

3. Create the signed development build:

   ```powershell
   npm run build:ios:dev
   ```

   The first run asks Expo to create/link an EAS project and manage Apple signing credentials. Install the finished build by opening its QR-code link on the registered iPhone.

4. On iPhone, enable **Settings > Privacy & Security > Developer Mode** if requested.

5. Start the development server on the PC:

   ```powershell
   npm run start:tunnel
   ```

6. Open **Seed Sprouter** on the iPhone, sign into the same Expo account in the development client if prompted, and select the running server.

JavaScript and image changes reload without rebuilding. Adding or changing native packages or native configuration requires a new development build.

## Local development

```powershell
npm install
npm run verify
npm start
```

The current build intentionally needs no backend account. Photos and data remain in the app's local documents/database storage, so uninstalling the app removes them. Cloud sync, household sharing and backup can be added later without changing the core bed/cycle model.

## Data and privacy

- Weather requests send only the fixed Newcastle coordinates to Open-Meteo.
- Garden and seed-packet photos are not uploaded by this app.
- Reminders are scheduled locally on the phone.
- Garden records use checksummed, schema-validated transactional saves. Five rotating SQLite snapshots plus independent immutable Documents snapshots are retained for recovery.
- Photos are copied to uniquely named immutable files in the app Documents directory and verified as non-empty before their URI is committed to garden data.
- Saved photo paths are resolved against the current iOS Documents container, so installing a new development build does not strand references on an older app-container UUID.
- If existing data cannot be verified or recovered, the app enters protected read-only mode instead of replacing it with an empty garden.

These protections cover interrupted writes, malformed JSON and accidental application-level overwrite. They cannot protect against uninstalling the app, erasing or losing the iPhone, or an operating-system storage failure. Device backup or a future encrypted cloud/export feature is still required for disaster recovery outside the app container.
