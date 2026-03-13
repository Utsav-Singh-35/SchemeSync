// Test snapshot parsing
const snapshotText = `- textbox "Customer name:" [ref=e1]
- textbox "Telephone:" [ref=e2]
- textbox "E-mail address:" [ref=e3]
- radio "Small" [ref=e4]
- radio "Medium" [ref=e5]
- radio "Large" [ref=e6]
- checkbox "Bacon" [ref=e7]
- checkbox "Extra Cheese" [ref=e8]
- checkbox "Onion" [ref=e9]
- checkbox "Mushroom" [ref=e10]
- textbox "Preferred delivery time:" [ref=e11]
- textbox "Delivery instructions:" [ref=e12]
- button "Submit order" [ref=e13]`;

function extractFormFields(snapshotText) {
    const fields = [];
    const lines = snapshotText.split('\n');
    
    for (const line of lines) {
        // Parse agent-browser snapshot format: - textbox "Customer name:" [ref=e1]
        const refMatch = line.match(/^-\s+(\w+)\s+"([^"]*)".*\[ref=(\w+)\]/);
        if (refMatch) {
            const [, type, label, ref] = refMatch;
            
            // Only include form-related elements
            const formTypes = ['textbox', 'input', 'searchbox', 'combobox', 'listbox', 'spinbutton', 'slider', 'checkbox', 'radio', 'button'];
            if (formTypes.includes(type.toLowerCase())) {
                fields.push({
                    ref,
                    type: type.toLowerCase(),
                    label: label.trim(),
                    name: inferFieldName(label)
                });
            }
        }
    }
    
    return fields;
}

function inferFieldName(label) {
    const lowerLabel = label.toLowerCase().replace(/[:\s]*$/, '');
    
    if (lowerLabel.includes('customer name') || lowerLabel.includes('name')) return 'name';
    if (lowerLabel.includes('telephone') || lowerLabel.includes('phone')) return 'phone';
    if (lowerLabel.includes('e-mail') || lowerLabel.includes('email')) return 'email';
    if (lowerLabel.includes('delivery time')) return 'deliveryTime';
    if (lowerLabel.includes('delivery instructions')) return 'instructions';
    
    return lowerLabel.replace(/[^a-zA-Z0-9]/g, '');
}

function mapProfileDataToField(field, userProfile) {
    const mappings = {
        'name': userProfile.name,
        'phone': userProfile.phone_number,
        'email': userProfile.email,
        'deliverytime': '6:00 PM',
        'instructions': 'Please ring the bell'
    };
    
    return mappings[field.name.toLowerCase()] || null;
}

// Test the parsing
console.log('🧪 Testing Snapshot Parsing...\n');

const fields = extractFormFields(snapshotText);
console.log(`Found ${fields.length} form fields:`);

const mockProfile = {
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    phone_number: '9876543210'
};

fields.forEach(field => {
    const value = mapProfileDataToField(field, mockProfile);
    console.log(`- @${field.ref} [${field.type}] "${field.label}" -> ${field.name} = ${value || 'NO MATCH'}`);
});

console.log('\n✅ Parsing test complete!');