# Product Requirements: Distributed Team Availability Dashboard

## 1. Executive Summary
The primary goal of this application is to solve the operational friction of coordinating global engineering teams across multiple time zones. This dashboard replaces manual time arithmetic, spreadsheet tracking, and constant messaging checks with a unified, real-time visual system.

---

## 2. Core Functional Requirements

### 2.1. The Main Dashboard View
*   **Visual Team Timeline**: A horizontal linear grid that plots out every team member’s working hours side-by-side for the current calendar day.
*   **Contextual Time Zone Shifting**: The system must automatically convert all displayed schedules into the local time of the user currently viewing the app.
*   **Live Status Sidebar**: A dedicated, scannable panel showing each developer's immediate availability state (e.g., Active, Away, Do Not Disturb, Offline).

### 2.2. Employee & Profile Management
*   **Custom Weekly Hours**: An easy-to-use profile page where an employee can specify their recurring working hours for each day of the week based on their local clock.
*   **Geographical Time Zone Selection**: A standardized location dropdown that allows a worker to alter their primary time zone when traveling, shifting their schedule globally.
*   **Quick Break Logger**: One-click dashboard actions to signal short-term absences (e.g., "Out for lunch for 45 minutes" or "Medical Appointment").

### 2.3. Smart Team Coordination
*   **Meeting Overlap Finder**: A utility tool where a coordinator selects specific team members, and the dashboard instantly highlights the overlapping hour slots where everyone is simultaneously online.
*   **Real-Time Browser Sync**: Status alterations (like logging off) must broadcast and render on teammate monitors instantly without a browser page refresh.

---

## 3. Engineering Constraints & Usability Goals
*   **Zero Manual Math**: The user interface must hide all UTC calculations and time zone math behind the scenes.
*   **High Scannability**: The visual layouts must allow a manager or teammate to check real-time availability in under two seconds.
*   **Data Accuracy**: The backend calculation pipeline must strictly handle date-time boundary transitions (e.g., when a teammate's workday crosses over into the user's next calendar day).
