import { Pool } from "pg";
import dotenv from 'dotenv';

dotenv.config();

const client = new Pool({
    host: process.env.DATABASE_URl,
    user: process.env.DATABASE_USER ,
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASS ,
    port: Number(process.env.DB_PORT),
    ssl: {
        rejectUnauthorized: false, // adjust as per your server's SSL configuration
    },
});

export const getContactsByEmailOrPhone = async (email: string | null, phoneNumber: string | null) => {
    let query = "SELECT * FROM contacts WHERE";
    const values: any[] = [];

    if (email) {
        query += " email = $1";
        values.push(email);
    }

    if (phoneNumber) {
        if (values.length > 0) {
            query += " OR";
        }
        query += " phone_number = $" + (values.length + 1);
        values.push(phoneNumber);
    }

    // If both email and phoneNumber are null, return an empty array
    if (values.length === 0) {
        return [];
    }

    // Execute the query to fetch matching contacts
    const result = await client.query(query, values);
    const primaryContacts = result.rows.filter(contacts => contacts.link_precedence === 'primary');
    const secondaryContacts: any[] = [];

    // If there are primary contacts, fetch their associated secondary contacts
    if (primaryContacts.length > 0) {
        const primaryContactIds = primaryContacts.map(contact => contact.id);
        const secondaryQuery = `
            SELECT * FROM contacts 
            WHERE link_precedence = 'secondary' 
            AND linked_id = ANY($1)
        `;
        const secondaryResult = await client.query(secondaryQuery, [primaryContactIds]);
        secondaryContacts.push(...secondaryResult.rows);
    }

    // Combine primary and secondary contacts into a map to avoid duplicates
    const uniqueContactsMap = new Map();

    for (const contact of [...result.rows, ...secondaryContacts]) {
        uniqueContactsMap.set(contact.id, contact);
    }

    // Convert the map back to an array of unique contacts
    const uniqueContacts = Array.from(uniqueContactsMap.values());

    return uniqueContacts;
};



export const createPrimaryContact = async (email: string | null, phoneNumber: string | null) => {
    const result = await client.query(
        'INSERT INTO contacts (email, phone_number, link_precedence) VALUES ($1, $2, $3) RETURNING id',
        [email, phoneNumber, 'primary']
    );
    return result.rows[0].id;
};

export const createSecondaryContact = async (primaryId: number, newEmail: string | null, newPhoneNumber: string | null) => {
    const result = await client.query(
        'INSERT INTO contacts (linked_id, link_precedence, email, phone_number) VALUES ($1, $2, $3, $4) RETURNING id', //UPDATE contacts SET linked_id = $1, link_precedence = $2 WHERE (email = $3 OR phone_number = $4) AND id != $1
        [primaryId, 'secondary', newEmail, newPhoneNumber]
    );
    return result.rows[0].id;
};

export const getConsolidatedContact = async (email: string | null, phoneNumber: string | null) => {
//    console.log("email Inputted: ", email);
//    console.log("phoneNumber Inputted: ", phoneNumber);
    const contacts = await getContactsByEmailOrPhone(email, phoneNumber);
//    console.log("Contacts which are Fetched: ", contacts);

    // Check if a contact with matching email or phone number exists with primary or secondary precedence
    const matchingContacts = contacts.filter(contact => 
        (contact.email === email || contact.phone_number === phoneNumber) &&
        (contact.link_precedence === 'primary' || contact.link_precedence === 'secondary')
    );

    // If no contacts are found, create a new primary contact
    if (contacts.length === 0) {
        const newId = await createPrimaryContact(email, phoneNumber);
//        console.log("NewContactCreated: ", newId);
        return {
            primaryContactId: newId,
            emails: email ? [email] : [],
            phoneNumbers: phoneNumber ? [phoneNumber] : [],
            secondaryContactIds: [],
        };
    } 

    // Gather all emails and phone numbers from both primary and secondary contacts
    const allEmails = [...new Set(contacts.map(c => c.email))];
    const allPhoneNumbers = [...new Set(contacts.map(c => c.phone_number))];
    const primaryContact = matchingContacts.find(contact => contact.link_precedence === 'primary') || matchingContacts[0];
    const secondaryContacts = contacts.filter(c => c.link_precedence === 'secondary');

    // If the email or phone number is different and there's no existing secondary contact, create a new secondary contact
    const isDifferent = matchingContacts.some(contact => 
        contact.email !== email || contact.phone_number !== phoneNumber
    );

    if (isDifferent && !secondaryContacts.length) {
        const secondaryId = await createSecondaryContact(primaryContact.id, email, phoneNumber);
//        console.log("This is the new secondaryId which is created", secondaryId);
        return {
            primaryContactId: primaryContact.id, // Keep the original primary contact ID
            emails: [...new Set(allEmails.concat(email ? [email] : []))],
            phoneNumbers: [...new Set(allPhoneNumbers.concat(phoneNumber ? [phoneNumber] : []))],
            secondaryContactIds: secondaryContacts.length + 1, // Include the newly created secondary contact
        };
    }

    // If a matching contact is found, return all associated contacts
    return {
        primaryContactId: primaryContact.id,
        emails: allEmails,
        phoneNumbers: allPhoneNumbers,
        secondaryContactIds: secondaryContacts.length, // Show the count of secondary contacts
    };
};



