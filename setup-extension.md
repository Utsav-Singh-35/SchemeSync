# SchemeSync Extension Setup Guide

## Quick Setup Instructions

### 1. Backend Setup (if not already done)

```bash
# Navigate to Backend directory
cd Backend

# Install dependencies (if not done)
npm install

# Run extension database migration
node src/database/migrate_extension.js

# Start the backend server
npm start
```

Backend should be running on `http://localhost:3000`

### 2. Frontend Setup (if not already done)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not done)
npm install

# Start the frontend
npm run dev
```

Frontend should be running on `http://localhost:5173`

### 3. Extension Installation

1. **Open Chrome Browser**
2. **Navigate to Extensions**
   - Type `chrome://extensions/` in address bar
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch (top right)

4. **Load Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `SchemeSync-extension` folder
   - Extension should appear in the list

5. **Verify Installation**
   - Extension icon should appear in Chrome toolbar
   - Click icon to see popup interface

### 4. User Account Setup

1. **Create SchemeSync Account**
   - Visit `http://localhost:5173`
   - Click "Register" and create account
   - Or login if account exists

2. **Complete Profile**
   - Navigate to Profile page
   - Fill in personal information:
     - Name, email, phone
     - Date of birth, gender
     - Address, state, district
     - Income, occupation, category
     - Any other relevant details

3. **Upload Documents (Optional)**
   - Upload identity documents (Aadhaar, PAN)
   - Upload certificates (Income, Caste, etc.)
   - These will be used for automatic document uploads

### 5. Test the Extension

1. **Visit a Government Portal**
   - Try `https://pmkisan.gov.in` (if accessible)
   - Or any `.gov.in` website with forms

2. **Activate Extension**
   - Look for green badge on extension icon
   - Click floating "Activate SchemeSync" button
   - Or use extension popup

3. **Test Autofill**
   - Extension should detect and fill form fields
   - Review filled information
   - Handle any missing field prompts

## Troubleshooting

### Extension Not Loading
- Ensure all files are in `SchemeSync-extension` folder
- Check Chrome console for errors
- Verify manifest.json is valid

### Backend Connection Issues
- Verify backend is running on port 3000
- Check CORS settings allow localhost:3000
- Ensure user is logged in to SchemeSync

### Forms Not Detected
- Check if website uses standard HTML forms
- Try refreshing the page
- Use extension popup to manually activate

### Fields Not Filling
- Ensure profile is complete in SchemeSync
- Check browser console for error messages
- Some fields may require manual input

## Development Notes

### File Structure Created
```
SchemeSync-extension/
├── manifest.json          # Extension configuration
├── background.js         # Service worker for API calls
├── content.js           # Main content script
├── popup.html           # Extension popup UI
├── popup.js             # Popup functionality
├── domAnalyzer.js       # Form detection and analysis
├── autofillEngine.js    # Field filling logic
├── uiOverlay.js         # User interface overlays
├── profileSync.js       # Profile synchronization
├── documentManager.js   # Document upload handling
├── icons/               # Extension icons (placeholders)
└── README.md           # Detailed documentation
```

### Backend APIs Added
- `GET /api/user/documents` - Fetch user documents
- `POST /api/user/profile/add-field` - Add dynamic profile fields
- `GET /api/user/profile/complete` - Get complete profile with custom fields
- `POST /api/autofill/log` - Log autofill attempts
- `GET /api/autofill/history` - Get autofill history
- `GET /api/autofill/stats` - Get autofill statistics

### Database Tables Added
- `user_custom_fields` - Dynamic profile fields
- `user_documents` - Document metadata
- `autofill_logs` - Autofill attempt tracking
- `form_field_mappings` - Field mapping learning
- `document_type_mappings` - Document type learning
- `portal_metadata` - Portal-specific configuration

## Security Features

- **No Auto-Submit**: Forms are never submitted automatically
- **User Review Required**: All data must be reviewed before submission
- **CAPTCHA Detection**: Automation pauses for manual CAPTCHA solving
- **Secure Communication**: All API calls use authentication tokens
- **No Local Storage**: Sensitive data is not stored in extension

## Next Steps

1. **Test on Real Portals**: Try extension on actual government websites
2. **Add More Portals**: Extend support to additional government portals
3. **Improve Field Mapping**: Enhance AI field detection accuracy
4. **Document Upload**: Implement actual document upload functionality
5. **Analytics**: Add usage analytics and success rate tracking

The SchemeSync Autofill Extension is now ready for testing and development!