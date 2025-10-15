import { 
    medoraTriageTurn,
    generateTriageAssessment,
    generateBookingSuggestions,
    generateClinicianHandoff
} from '../services/gemini.js';
import { sendWhatsAppButtons, sendWhatsAppText } from '../services/whatsapp.js';

const sessions = new Map();

export function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, { 
            chatHistory: [],
            stage: 'intake',
            triageAssessment: null,
            turnCount: 0,
            attachments: [],
            bookingConfirmed: false,
            bookingData: {
                region: null,
                specialty: null,
                doctorName: null,
                consultationType: null,
                patientDetails: {
                    name: null,
                    age: null,
                    phone: null,
                    email: null
                }
            }
        });
    }
	return sessions.get(userId);
}

export async function handleUserMessage(userId, text) {
	const s = getSession(userId);
    s.turnCount++;
    
    // Add patient message to conversation history
    s.chatHistory.push({ role: 'patient', text });
    
    // Keep conversation history manageable (last 20 messages)
    if (s.chatHistory.length > 20) {
        s.chatHistory = s.chatHistory.slice(-20);
    }

    // Handle booking flow stages
    if (s.stage.startsWith('booking_')) {
        return await handleBookingFlow(userId, text, s);
    }

    try {
        // Get Gemini's natural response
        const geminiResponse = await medoraTriageTurn(s.chatHistory, text);
        
        if (geminiResponse) {
            // Add Gemini's response to conversation history
            s.chatHistory.push({ role: 'clinician', text: geminiResponse });
            
            // Generate structured triage assessment for internal tracking
            if (s.turnCount >= 3 && !s.triageAssessment) {
                try {
                    s.triageAssessment = await generateTriageAssessment(s.chatHistory, text);
                    
                    // Fallback if JSON parsing failed
                    if (!s.triageAssessment) {
                        console.log('Creating fallback triage assessment');
                        s.triageAssessment = {
                            assessment: 'Patient seeking medical consultation',
                            urgency: 'Routine',
                            recommendation: 'Consult with a General Practitioner',
                            specialty: 'General Practice'
                        };
            }
        } catch (e) {
                    console.warn('Triage assessment failed, continuing with conversation', e);
                }
            }
            
            // If triage suggests booking, start detailed booking flow
            if (s.triageAssessment && s.triageAssessment.urgency !== 'Self-care' && s.stage === 'intake') {
                s.stage = 'booking_region';
                s.bookingData.specialty = s.triageAssessment.specialty || 'General Practice';
                return `Based on your symptoms, I recommend consulting with a ${s.bookingData.specialty} specialist. To help you find the right doctor, which city or region are you located in?`;
            }
            
            return geminiResponse;
        }
        
    } catch (e) {
        console.warn('MEDORA triage error', e);
    }

    // Fallback response
    return 'I understand. Could you tell me more about what\'s concerning you today?';
}

// Handle detailed booking flow
async function handleBookingFlow(userId, text, s) {
    switch (s.stage) {
        case 'booking_region':
            s.bookingData.region = text;
            s.stage = 'booking_consultation_type';
            // Get doctor suggestions based on specialty and region
            const doctorName = await getDoctorSuggestion(s.bookingData.specialty, s.bookingData.region);
            s.bookingData.doctorName = doctorName;
            return `Great! I found Dr. ${doctorName}, a ${s.bookingData.specialty} specialist in ${s.bookingData.region}. Would you prefer a teleconsultation or an in-person visit?`;

        case 'booking_consultation_type':
            if (text.toLowerCase().includes('tele') || text.toLowerCase().includes('video') || text.toLowerCase().includes('online')) {
                s.bookingData.consultationType = 'teleconsultation';
            } else {
                s.bookingData.consultationType = 'in-person';
            }
            s.stage = 'booking_patient_details';
            return `Perfect! You've chosen ${s.bookingData.consultationType}. Now I need some details to complete your booking. What's your full name?`;

        case 'booking_patient_details':
            if (!s.bookingData.patientDetails.name) {
                s.bookingData.patientDetails.name = text;
                return `Thank you, ${text}. What's your age?`;
            } else if (!s.bookingData.patientDetails.age) {
                s.bookingData.patientDetails.age = text;
                return `Got it. What's your phone number?`;
            } else if (!s.bookingData.patientDetails.phone) {
                s.bookingData.patientDetails.phone = text;
                return `And your email address?`;
            } else if (!s.bookingData.patientDetails.email) {
                s.bookingData.patientDetails.email = text;
                s.stage = 'booking_confirmation';
                return generateBookingConfirmation(s.bookingData);
            }
            break;

        case 'booking_confirmation':
            if (text.toLowerCase().includes('yes') || text.toLowerCase().includes('confirm') || text.toLowerCase().includes('book')) {
                s.bookingConfirmed = true;
                s.stage = 'completed';
                
                // Generate comprehensive clinician handoff summary
                const handoffSummary = await generateClinicianHandoff(s.chatHistory, s.triageAssessment, s.attachments);
                console.log('=== CLINICIAN HANDOFF SUMMARY ===');
                console.log(handoffSummary);
                console.log('================================');
                
                return `✅ Booking confirmed! You'll receive appointment details within 2 hours.`;
        } else {
                s.stage = 'booking_region';
                s.bookingData = {
                    region: null,
                    specialty: s.bookingData.specialty,
                    doctorName: null,
                    consultationType: null,
                    patientDetails: { name: null, age: null, phone: null, email: null }
                };
                return `No problem. Let's start over. Which city or region are you located in?`;
            }
    }
    
    return 'I understand. Could you please provide the information I asked for?';
}

// Get doctor suggestion based on specialty and region
async function getDoctorSuggestion(specialty, region) {
    // Mock doctor database - in production, this would query a real database
    const doctors = {
        'Cardiology': {
            'Belgaum': 'Dr. Vikram Joshi',
            'Hubli': 'Dr. Priya Desai',
            'Dharwad': 'Dr. Rajesh Patil'
        },
        'Gastroenterology': {
            'Belgaum': 'Dr. Sunita Kulkarni',
            'Hubli': 'Dr. Ravi Shetty',
            'Dharwad': 'Dr. Priya Gowda'
        },
        'Neurology': {
            'Belgaum': 'Dr. Anil Patil',
            'Hubli': 'Dr. Meera Joshi',
            'Dharwad': 'Dr. Suresh Kulkarni'
        },
        'Dermatology': {
            'Belgaum': 'Dr. Kavita Patil',
            'Hubli': 'Dr. Rajesh Shetty',
            'Dharwad': 'Dr. Sunita Gowda'
        },
        'Orthopedics': {
            'Belgaum': 'Dr. Suresh Patil',
            'Hubli': 'Dr. Priya Joshi',
            'Dharwad': 'Dr. Rajesh Kulkarni'
        },
        'Psychiatry': {
            'Belgaum': 'Dr. Anitha Patil',
            'Hubli': 'Dr. Vikram Shetty',
            'Dharwad': 'Dr. Meera Gowda'
        },
        'Pulmonology': {
            'Belgaum': 'Dr. Sunil Patil',
            'Hubli': 'Dr. Kavita Joshi',
            'Dharwad': 'Dr. Rajesh Shetty'
        },
        'Endocrinology': {
            'Belgaum': 'Dr. Priya Patil',
            'Hubli': 'Dr. Suresh Joshi',
            'Dharwad': 'Dr. Anitha Kulkarni'
        },
        'Urology': {
            'Belgaum': 'Dr. Vikram Patil',
            'Hubli': 'Dr. Sunita Shetty',
            'Dharwad': 'Dr. Rajesh Gowda'
        },
        'Ophthalmology': {
            'Belgaum': 'Dr. Kavita Patil',
            'Hubli': 'Dr. Suresh Joshi',
            'Dharwad': 'Dr. Priya Shetty'
        },
        'General Practice': {
            'Belgaum': 'Dr. Anil Patil',
            'Hubli': 'Dr. Sunita Joshi',
            'Dharwad': 'Dr. Rajesh Kulkarni'
        }
    };
    
    const regionKey = Object.keys(doctors[specialty] || doctors['General Practice']).find(key => 
        key.toLowerCase().includes(region.toLowerCase()) || region.toLowerCase().includes(key.toLowerCase())
    );
    
    return doctors[specialty]?.[regionKey] || doctors['General Practice'][regionKey] || 'Dr. Available Specialist';
}

// Generate booking confirmation message
function generateBookingConfirmation(bookingData) {
    return `📋 **Booking Summary:**

👨‍⚕️ **Doctor:** Dr. ${bookingData.doctorName}
🏥 **Specialty:** ${bookingData.specialty}
📍 **Location:** ${bookingData.region}
💻 **Type:** ${bookingData.consultationType}

Please confirm by typing "Yes" to book your appointment.`;
}

// Legacy functions removed - all logic now handled by Gemini

// Handle button replies in webhook → conversation entry
export async function handleInteractiveReply(userId, id) {
    const s = getSession(userId);
    
    if (id === 'book_tele' || id === 'book_inperson') {
        // Legacy button support - redirect to new flow
        s.stage = 'booking_region';
        s.bookingData.specialty = s.triageAssessment?.specialty?.[0] || 'General Practice';
        return `Based on your symptoms, I recommend consulting with a ${s.bookingData.specialty} specialist. To help you find the right doctor, which city or region are you located in?`;
    }
    
    return 'I understand. Is there anything else I can help you with regarding your health concern?';
}

// Parse free-text after buttons to collect region, then suggest doctors and ask for patient details
export async function continueBookingAfterText() { return null; }

// All medical reasoning now handled by Gemini


