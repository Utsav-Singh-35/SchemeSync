# SchemeSync Autofill Browser Extension

AI-powered form filling assistant for government scheme applications.

## Features

- **Automatic Form Detection**: Detects application forms on government portals
- **Smart Field Mapping**: Maps form fields to user profile data using AI
- **Document Upload Assistance**: Automatically selects and uploads required documents
- **Dynamic Profile Expansion**: Learns new profile fields from forms
- **CAPTCHA Detection**: Pauses automation when CAPTCHAs are detected
- **Safety First**: Never automatically submits forms - user review required

## Installation

### Development Setup

1. **Prerequisites**
   - Chrome browser
   - SchemeSync backend running on `http://localhost:3000`
   - User account with completed profile

2. **Load Extension**
   ```bash
   # Open Chrome and navigate to:
   chrome://extensions/
   
   # Enable Developer mode (top right toggle)
   # Click "Load unpacked"
   # Select the SchemeSync-extension folder
   ```

3. **Setup Backend**
   ```bash
   # Run database migration for extension tables
   cd Backend
   node src/database/migrate_extension.js
   
   # Restart backend server
   npm start
   ```

## Usage

### First Time Setup

1. **Login to SchemeSync**
   - Visit `http://localhost:5173`
   - Create account or login
   - Complete your profile with personal information

2. **Extension Authentication**
   - Extension automatically detects your login status
   - No separate authentication required

### Using the Extension

1. **Navigate to Government Portal**
   - Visit any government scheme application portal
   - Extension icon will show green badge if forms are detected

2. **Activate Autofill**
   - Click the floating "Activate SchemeSync" button
   - Or use the extension popup (click extension icon)

3. **Review and Submit**
   - Extension fills detected fields automatically
   - Review all filled information carefully
   - Handle any missing fields when prompted
   - Solve CAPTCHAs manually if present
   - Submit form manually after verification

## Supported Portals

- PM-KISAN Portal (`pmkisan.gov.in`)
- Ayushman Bharat PM-JAY (`pmjay.gov.in`)
- National Scholarship Portal (`scholarships.gov.in`)
- India Portal (`india.gov.in`)
- Any government portal with `.gov.in` domain

## Architecture

### Core Components

- **Content Script** (`content.js`): Main extension logic, form detection
- **Background Service** (`background.js`): API communication, data management
- **DOM Analyzer** (`domAnalyzer.js`): Form field detection and mapping
- **Autofill Engine** (`autofillEngine.js`): Field population logic
- **UI Overlay** (`uiOverlay.js`): User interface components
- **Profile Sync** (`profileSync.js`): Profile data synchronization
- **Document Manager** (`documentManager.js`): Document upload handling

### Security Features

- **No Automatic Submission**: Forms are never submitted automatically
- **User Review Required**: All filled data must be reviewed by user
- **Secure API Communication**: All backend communication uses authentication
- **No Sensitive Data Storage**: Extension doesn't store sensitive data locally

## API Integration

### Backend Endpoints Used

- `GET /api/auth/profile` - Fetch user profile
- `GET /api/user/documents` - Get user documents
- `POST /api/user/profile/add-field` - Add new profile field
- `POST /api/autofill/log` - Log autofill attempts

### Data Flow

1. Extension detects forms on page
2. Fetches user profile from backend
3. Maps form fields to profile data
4. Fills fields with user data
5. Handles document uploads
6. Prompts for missing information
7. Syncs new data back to backend
8. Logs attempt for analytics

## Development

### File Structure

```
SchemeSync-extension/
├── manifest.json           # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── domAnalyzer.js        # Form analysis
├── autofillEngine.js     # Field filling
├── uiOverlay.js          # UI components
├── profileSync.js        # Profile synchronization
├── documentManager.js    # Document handling
├── icons/                # Extension icons
└── README.md            # This file
```

### Adding New Portal Support

1. **Update Portal Metadata**
   ```sql
   INSERT INTO portal_metadata (hostname, portal_name, form_detection_rules)
   VALUES ('newportal.gov.in', 'New Portal', '{"selectors": ["form"]}');
   ```

2. **Add Field Mappings**
   - Update `domAnalyzer.js` field mappings
   - Add portal-specific patterns

3. **Test Integration**
   - Navigate to portal
   - Test form detection
   - Verify field mapping accuracy

## Troubleshooting

### Extension Not Working

1. **Check Authentication**
   - Ensure logged into SchemeSync portal
   - Verify backend is running on port 3000

2. **Check Permissions**
   - Extension needs access to all websites
   - Verify manifest permissions are granted

3. **Check Console Logs**
   - Open Developer Tools (F12)
   - Check Console tab for errors
   - Look for SchemeSync log messages

### Forms Not Detected

1. **Check Portal Support**
   - Verify portal is in supported list
   - Check if portal uses standard form elements

2. **Manual Activation**
   - Try clicking extension icon
   - Use popup to activate manually

### Fields Not Filling

1. **Check Profile Completeness**
   - Ensure profile has required data
   - Add missing fields in SchemeSync portal

2. **Check Field Mapping**
   - Some fields may not be recognized
   - Extension will prompt for missing data

## Security Considerations

- Extension requires broad permissions to work on all government portals
- All data transmission is encrypted via HTTPS
- No sensitive data is stored in extension storage
- User must manually review and submit all forms
- CAPTCHA detection prevents automated abuse

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify backend connectivity
3. Ensure profile is complete in SchemeSync portal
4. Contact development team with specific error details