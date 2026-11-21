import { ApplicationProcedureInfo, Scheme, SupportedLanguage } from '../types';
import { getDocumentLabel, pickText } from './i18n';
import { getOfficialPortalDisplayHost, resolveSchemePortalUrl } from './liveDataEngine';

export interface LocalizedApplicationProcedure {
  portalUrl: string;
  portalHost: string;
  mode: string;
  estimatedTime: string;
  steps: string[];
  nodalOffice: string;
  helpline: string;
}

/**
 * Scheme-specific official application procedures for flagship schemes,
 * supplemented by accurate governance-tier procedures referencing each scheme's
 * verified official portal, required documents, Indore nodal office, and CSC support.
 */
const FLAGSHIP_PROCEDURES: Record<string, ApplicationProcedureInfo> = {
  pm_kisan: {
    mode: 'Online Portal (pmkisan.gov.in) / Patwari & CSC Kiosk',
    modeHindi: 'ऑनलाइन पोर्टल (pmkisan.gov.in) / पटवारी एवं सीएससी कियोस्क',
    modeMalwi: 'ऑनलाइन वेबसाइट (pmkisan.gov.in) या पटवारी / एमपी ऑनलाइन',
    estimatedTime: '15–30 Days (after Patwari land verification)',
    estimatedTimeHindi: '15–30 दिन (पटवारी भूमि सत्यापन के बाद)',
    estimatedTimeMalwi: '15–30 दिन (पटवारी जमीन जांच रा बाद)',
    steps: [
      'Open the official PM-KISAN portal (pmkisan.gov.in) and select "New Farmer Registration" under Farmers Corner.',
      'Enter your 12-digit Aadhaar number, registered mobile number, select Madhya Pradesh (Indore District), and verify via OTP.',
      'Fill in Khasra / Khatauni (B-1) agricultural land details and upload land record & Aadhaar-seeded DBT bank passbook.',
      'Complete mandatory Aadhaar e-KYC on the portal or at your nearest Indore CSC / MPOnline center.',
      'District Agriculture Office & Patwari verify land ownership; ₹2,000 installments credit every 4 months directly via DBT.',
    ],
    stepsHindi: [
      'आधिकारिक पीएम-किसान पोर्टल (pmkisan.gov.in) खोलें और "New Farmer Registration" चुनें।',
      'अपना 12-अंकीय आधार नंबर, मोबाइल नंबर दर्ज कर मध्य प्रदेश (इंदौर जिला) चुनें और ओटीपी सत्यापित करें।',
      'अपनी कृषि भूमि का खसरा / बी-1 विवरण भरें और भूमि अभिलेख व आधार-लिंक्ड डीबीटी बैंक पासबुक अपलोड करें।',
      'पोर्टल या नजदीकी सीएससी / एमपी ऑनलाइन केंद्र पर अनिवार्य आधार ई-केवाईसी पूर्ण करें।',
      'पटवारी व जिला कृषि कार्यालय द्वारा सत्यापन के बाद प्रति 4 माह में ₹2,000 सीधे बैंक खाते में डीबीटी से आते हैं।',
    ],
    stepsMalwi: [
      'सरकारी पीएम-किसान वेबसाइट (pmkisan.gov.in) खोलो अने "New Farmer Registration" दबावो।',
      'थारो 12 अंक रो आधार नंबर, मोबाइल नंबर लिखो, मध्य प्रदेश (इंदौर जिला) चुनो अने ओटीपी सूं जांच करो।',
      'खेत री जमीन रो खसरा / बी-1 विवरण भरो अने जमीन कागद व डीबीटी बैंक पासबुक चढ़ावो।',
      'वेबसाइट या नजदीकी एमपी ऑनलाइन / सीएससी दुकान पर आधार ई-केवाईसी पूरी करवावो।',
      'पटवारी अने कृषि दफ्तर री जांच रा बाद हर 4 महीना मां ₹2,000 सीधा बैंक खाता मां आ जावे छे।',
    ],
  },
  mp_ladli_behna: {
    mode: 'Official Portal (cmladlibahna.mp.gov.in) / Ward Camp & Gram Panchayat',
    modeHindi: 'आधिकारिक पोर्टल (cmladlibahna.mp.gov.in) / वार्ड शिविर व ग्राम पंचायत',
    modeMalwi: 'सरकारी पोर्टल (cmladlibahna.mp.gov.in) / वार्ड कैंप या ग्राम पंचायत',
    estimatedTime: '15–30 Days (Monthly DBT on 10th of each month)',
    estimatedTimeHindi: '15–30 दिन (प्रति माह 10 तारीख को सीधे डीबीटी)',
    estimatedTimeMalwi: '15–30 दिन (हर महीना री 10 तारीख ने खाता मां रुपया)',
    steps: [
      'Ensure your 9-digit Samagra Member ID has completed Aadhaar e-KYC and your bank account is Aadhaar + DBT enabled.',
      'Visit your IMC Ward Karyalaya (Urban) or Gram Panchayat / Anganwadi Camp (Rural) with Samagra ID, Aadhaar, and mobile phone.',
      'The camp operator enters your details on cmladlibahna.mp.gov.in and captures a live photograph of the applicant.',
      'Verify the OTP sent to your registered mobile and collect the printed Application Acknowledgement Number.',
      'Check final beneficiary list & monthly ₹1,500 DBT credit status online on cmladlibahna.mp.gov.in.',
    ],
    stepsHindi: [
      'सुनिश्चित करें कि आपकी 9-अंकीय समग्र सदस्य आईडी की आधार ई-केवाईसी पूर्ण है और बैंक खाता आधार-डीबीटी सक्रिय है।',
      'समग्र आईडी, आधार कार्ड व मोबाइल के साथ अपने नगर निगम वार्ड कार्यालय (शहरी) या ग्राम पंचायत / आंगनवाड़ी केंद्र (ग्रामीण) जाएं।',
      'ऑपरेटर cmladlibahna.mp.gov.in पर आपका विवरण दर्ज कर आवेदिका की लाइव फोटो कैप्चर करेगा।',
      'पंजीकृत मोबाइल पर प्राप्त ओटीपी सत्यापित करें और आवेदन पावती क्रमांक प्राप्त करें।',
      'अंतिम पात्र सूची व हर माह ₹1,500 डीबीटी भुगतान की स्थिति cmladlibahna.mp.gov.in पर ऑनलाइन देखें।',
    ],
    stepsMalwi: [
      'पेहला पक्को कर लो कि थारी 9 अंक री समग्र आईडी रो आधार ई-केवाईसी पूरो छे अने बैंक खाता मां डीबीटी चालू छे।',
      'समग्र आईडी, आधार कार्ड अने मोबाइल ले ने नगर निगम वार्ड दफ्तर या गाँव री ग्राम पंचायत / आंगनवाड़ी शिविर मां जावो।',
      'दफ्तर वालो cmladlibahna.mp.gov.in पर थारी जानकारी भरेगो अने बाईजी रो सीधो फोटो लेवेगो।',
      'मोबाइल पर आयो ओटीपी बतावो अने अर्जी री रसीद (पावती नंबर) संभाल ने राखो।',
      'अंतिम सूची अने हर महीना ₹1,500 खाता मां आया कि नी, cmladlibahna.mp.gov.in पर चेक करो।',
    ],
  },
  ayushman_bharat: {
    mode: 'Online Beneficiary Portal (pmjay.gov.in) / CSC & Empaneled Hospitals',
    modeHindi: 'ऑनलाइन पोर्टल (pmjay.gov.in) / सीएससी व संबद्ध अस्पताल',
    modeMalwi: 'ऑनलाइन पोर्टल (pmjay.gov.in) / एमपी ऑनलाइन या अस्पताल काउंटर',
    estimatedTime: 'Same Day – 3 Days (Instant e-Card Approval)',
    estimatedTimeHindi: 'उसी दिन – 3 दिन (त्वरित ई-कार्ड स्वीकृति)',
    estimatedTimeMalwi: 'उसी दिन सूं 3 दिन मां (आयुष्मान कार्ड तैयार)',
    steps: [
      'Visit the official Ayushman Bharat portal (pmjay.gov.in) or Beneficiary NHA portal and click "Am I Eligible".',
      'Verify eligibility using your Mobile OTP, Samagra Family ID, BPL/Ration Card, or Sambal 2.0 registration (or Age 70+ Aadhaar).',
      'Complete Aadhaar OTP / Biometric e-KYC online or at any Indore CSC kiosk / MY Hospital Ayushman Mitra desk.',
      'Download your verified Ayushman Golden Card (up to ₹5 Lakh/year cashless cover per family).',
      'Present the Ayushman Card at any empaneled government or private hospital in Indore for paperless cashless treatment.',
    ],
    stepsHindi: [
      'आधिकारिक आयुष्मान भारत पोर्टल (pmjay.gov.in) खोलें और "Am I Eligible" पर क्लिक करें।',
      'मोबाइल ओटीपी, समग्र परिवार आईडी, बीपीएल/राशन कार्ड या संबल 2.0 (या 70+ आयु आधार) से पात्रता जांचें।',
      'ऑनलाइन या नजदीकी इंदौर सीएससी / एमवाय अस्पताल आयुष्मान मित्र डेस्क पर आधार ई-केवाईसी पूर्ण करें।',
      'अपना सत्यापित आयुष्मान गोल्डन कार्ड डाउनलोड करें (प्रति परिवार प्रति वर्ष ₹5 लाख तक कैशलेस इलाज)।',
      'इंदौर के किसी भी संबद्ध सरकारी या निजी अस्पताल में कार्ड दिखाकर निःशुल्क कैशलेस उपचार प्राप्त करें।',
    ],
    stepsMalwi: [
      'सरकारी आयुष्मान वेबसाइट (pmjay.gov.in) खोलो अने "Am I Eligible" पर दबावो।',
      'मोबाइल ओटीपी, समग्र कुटुंब आईडी, बीपीएल कार्ड या संबल कार्ड (या 70 साल सूं ऊपर आधार) सूं पात्रता देखो।',
      'ऑनलाइन या नजदीकी एमपी ऑनलाइन / एमवाय अस्पताल रा आयुष्मान मित्र काउंटर पर आधार ई-केवाईसी करवावो।',
      'थारो पक्को आयुष्मान गोल्डन कार्ड डाउनलोड करो (₹5 लाख साल तक मुफ्त इलाज)।',
      'इंदौर रा कोई भी जुड़ेड़ा सरकारी या प्राइवेट अस्पताल मां कार्ड दिखा ने मुफ्त इलाज करवावो।',
    ],
  },
  pmay_urban: {
    mode: 'Online Portal (pmaymis.gov.in) / IMC Awas Cell & Zonal Offices',
    modeHindi: 'ऑनलाइन पोर्टल (pmaymis.gov.in) / नगर निगम आवास प्रकोष्ठ',
    modeMalwi: 'ऑनलाइन पोर्टल (pmaymis.gov.in) / इंदौर नगर निगम आवास दफ्तर',
    estimatedTime: '30–60 Days (After Geo-Tagged Site Survey)',
    estimatedTimeHindi: '30–60 दिन (जियो-टैग सर्वे के बाद)',
    estimatedTimeMalwi: '30–60 दिन (मकान री जियो-टैग जांच रा बाद)',
    steps: [
      'Visit the official PMAY-Urban portal (pmaymis.gov.in) and choose "Citizen Assessment" -> "Apply Online".',
      'Authenticate with your 12-digit Aadhaar number and select Madhya Pradesh -> Indore Municipal Corporation (Ward 1–85).',
      'Enter family income, Samagra Family ID, existing kutcha/plot details, and Aadhaar-linked bank account details.',
      'Submit the application and download the Assessment ID for verification by IMC Awas Cell engineers.',
      'After geo-tagged physical inspection of each construction stage, up to ₹2.50 Lakh subsidy is released via DBT.',
    ],
    stepsHindi: [
      'आधिकारिक पीएमएवाई-शहरी पोर्टल (pmaymis.gov.in) खोलें और "Citizen Assessment" -> "Apply Online" चुनें।',
      'अपने 12-अंकीय आधार से सत्यापन करें और मध्य प्रदेश -> इंदौर नगर निगम (वार्ड 1–85) चुनें।',
      'पारिवारिक आय, समग्र परिवार आईडी, कच्चे मकान/भूखंड व आधार-लिंक्ड बैंक खाते की जानकारी भरें।',
      'आवेदन जमा करें और नगर निगम आवास प्रकोष्ठ द्वारा सत्यापन हेतु Assessment ID सुरक्षित रखें।',
      'निर्माण के प्रत्येक चरण के जियो-टैग निरीक्षण के बाद ₹2.50 लाख तक का अनुदान सीधे डीबीटी से खाते में आता है।',
    ],
    stepsMalwi: [
      'सरकारी पीएम आवास पोर्टल (pmaymis.gov.in) खोलो अने "Citizen Assessment" -> "Apply Online" चुनो।',
      'थारो आधार नंबर डाल ने जांच करो अने मध्य प्रदेश -> इंदौर नगर निगम (वार्ड 1–85) चुनो।',
      'कुटुंब री कमाई, समग्र नंबर, कच्चा मकान या प्लॉट अने बैंक खाता री जानकारी भरो।',
      'अर्जी जमा करो अने नगर निगम जांच खातर रसीद नंबर (Assessment ID) संभाल ने राखो।',
      'इंजीनियर री जियो-टैग जांच रा बाद मकान बणवा खातर ₹2.50 लाख तक री किस्त सीधा खाता मां आवे छे।',
    ],
  },
  pm_svanidhi: {
    mode: 'Online Portal (pmsvanidhi.mohua.gov.in) / IMC TVC & CSC Kiosk',
    modeHindi: 'ऑनलाइन पोर्टल (pmsvanidhi.mohua.gov.in) / नगर निगम टीवीसी व सीएससी',
    modeMalwi: 'ऑनलाइन पोर्टल (pmsvanidhi.mohua.gov.in) / नगर निगम व सीएससी दुकान',
    estimatedTime: '10–21 Days (Collateral-Free Working Capital)',
    estimatedTimeHindi: '10–21 दिन (बिना गारंटी कार्यशील पूंजी ऋण)',
    estimatedTimeMalwi: '10–21 दिन (बिना गारंटी ठेलो-धंधो कर्जो)',
    steps: [
      'Visit pmsvanidhi.mohua.gov.in and select your loan tranche (₹10,000 / ₹20,000 / ₹50,000).',
      'Verify mobile number via OTP and enter your IMC Street Vendor Certificate of Vending (CoV) or Letter of Recommendation (LoR).',
      'If you do not yet have a Vendor ID, apply for a Letter of Recommendation through your IMC Zonal Office Town Vending Committee.',
      'Complete Aadhaar e-KYC, choose your preferred Indore bank branch, and upload bank passbook details.',
      'Once sanctioned by the bank, working capital is credited directly; digital UPI transactions earn up to ₹1,200/yr cashback.',
    ],
    stepsHindi: [
      'आधिकारिक पोर्टल pmsvanidhi.mohua.gov.in खोलें और ऋण श्रेणी (₹10,000 / ₹20,000 / ₹50,000) चुनें।',
      'मोबाइल ओटीपी से सत्यापन कर नगर निगम स्ट्रीट वेंडर प्रमाण-पत्र (CoV) या अनुशंसा पत्र (LoR) दर्ज करें।',
      'यदि वेंडर आईडी नहीं है, तो अपने इंदौर नगर निगम जोन की टाउन वेंडिंग समिति से अनुशंसा पत्र प्राप्त करें।',
      'आधार ई-केवाईसी पूर्ण कर अपनी नजदीकी इंदौर बैंक शाखा चुनें और पासबुक विवरण अपलोड करें।',
      'बैंक स्वीकृति पर राशि सीधे खाते में आती है; डिजिटल यूपीआई लेन-देन पर ₹1,200/वर्ष तक कैशबैक मिलता है।',
    ],
    stepsMalwi: [
      'सरकारी वेबसाइट pmsvanidhi.mohua.gov.in खोलो अने कर्जा री किस्त (₹10,000 / ₹20,000 / ₹50,000) चुनो।',
      'मोबाइल ओटीपी सूं जांच कर ने नगर निगम रो फेरीवाला कार्ड या सिफारिश कागद (LoR) दर्ज करो।',
      'अगर फेरीवाला कार्ड नी होवे तो नगर निगम जोन दफ्तर री समिति सूं सिफारिश पत्र बनवावो।',
      'आधार ई-केवाईसी करो, नजदीकी बैंक चुनो अने बैंक पासबुक री जानकारी अपलोड करो।',
      'बैंक मंजूरी रा बाद सीधा खाता मां कर्जो आ जावे छे अने यूपीआई लेन-देन पर साल रो ₹1,200 कैशबैक भी मिले छे।',
    ],
  },
  pm_surya_ghar: {
    mode: 'National Portal (pmsuryaghar.gov.in) + MPPKVVCL Discom Sync',
    modeHindi: 'राष्ट्रीय पोर्टल (pmsuryaghar.gov.in) + पश्चिम क्षेत्र विद्युत वितरण कंपनी',
    modeMalwi: 'सरकारी पोर्टल (pmsuryaghar.gov.in) + इंदौर बिजली विभाग',
    estimatedTime: '20–45 Days (Discom Net-Metering & DBT Subsidy)',
    estimatedTimeHindi: '20–45 दिन (डिस्कॉम नेट-मीटरिंग एवं डीबीटी सब्सिडी)',
    estimatedTimeMalwi: '20–45 दिन (नेट-मीटरिंग अने सीधा खाता मां सब्सिडी)',
    steps: [
      'Register on pmsuryaghar.gov.in by selecting Madhya Pradesh and your electricity distributor (MPPKVVCL Indore).',
      'Enter your Electricity Consumer Account Number (IVRS), registered mobile number, and email ID.',
      'Submit the Rooftop Solar installation request and wait for online technical feasibility approval from MPPKVVCL.',
      'Get the solar plant installed by an empaneled vendor in Indore and apply for net-metering on the portal.',
      'After Discom inspection & commissioning certificate, enter bank details on the portal to receive up to ₹78,000 DBT subsidy.',
    ],
    stepsHindi: [
      'pmsuryaghar.gov.in पर पंजीकरण करें और मध्य प्रदेश व विद्युत वितरण कंपनी (MPPKVVCL इंदौर) चुनें।',
      'अपना बिजली उपभोक्ता क्रमांक (IVRS), मोबाइल नंबर और ईमेल दर्ज करें।',
      'रूफटॉप सोलर लगाने का आवेदन जमा करें और बिजली विभाग से तकनीकी स्वीकृति (Feasibility) प्राप्त करें।',
      'इंदौर के पंजीकृत वेंडर से सोलर पैनल लगवाएं और पोर्टल पर नेट-मीटरिंग हेतु आवेदन करें।',
      'बिजली विभाग के निरीक्षण व प्रमाण-पत्र के बाद बैंक विवरण दर्ज करें; ₹78,000 तक सब्सिडी डीबीटी से खाते में आएगी।',
    ],
    stepsMalwi: [
      'pmsuryaghar.gov.in पर जा ने मध्य प्रदेश अने इंदौर बिजली कंपनी (MPPKVVCL) चुनो।',
      'थारो बिजली बिल रो नंबर (IVRS), मोबाइल नंबर अने ईमेल भरो।',
      'छत पर सोलर लगवाण री अर्जी भरो अने बिजली विभाग री तकनीकी मंजूरी पावो।',
      'इंदौर रा सरकारी पंजीकृत वेंडर सूं सोलर लगवावो अने पोर्टल पर नेट-मीटर खातर अर्जी देवो।',
      'निरीक्षण रा बाद बैंक खाता री जानकारी भरो, ₹78,000 तक सब्सिडी सीधा खाता मां आ जावेगी।',
    ],
  },
  mp_sambal_2: {
    mode: 'Official Portal (sambal.mp.gov.in) / MPOnline & IMC Ward / Janpad',
    modeHindi: 'आधिकारिक पोर्टल (sambal.mp.gov.in) / एमपी ऑनलाइन व वार्ड/जनपद',
    modeMalwi: 'सरकारी पोर्टल (sambal.mp.gov.in) / एमपी ऑनलाइन या वार्ड-जनपद',
    estimatedTime: '15–25 Days (Digital Sambal Card Issued)',
    estimatedTimeHindi: '15–25 दिन (डिजिटल संबल कार्ड जारी)',
    estimatedTimeMalwi: '15–25 दिन (संबल 2.0 कार्ड तैयार)',
    steps: [
      'Visit sambal.mp.gov.in and click "पंजीयन हेतु आवेदन करें" (Apply for Registration).',
      'Enter your 9-digit Samagra Member ID and 8-digit Family ID to fetch your verified household details.',
      'Choose your unorganized worker category (Construction, Gig/Platform, Tendu/Labour), income declaration, and mobile OTP.',
      'Submit the form to receive your Application Number; Indore Ward Office or Janpad Panchayat conducts inquiry verification.',
      'Download your approved Sambal 2.0 Smart Card from sambal.mp.gov.in to unlock education, maternity, and accident benefits.',
    ],
    stepsHindi: [
      'आधिकारिक पोर्टल sambal.mp.gov.in खोलें और "पंजीयन हेतु आवेदन करें" पर क्लिक करें।',
      'अपनी 9-अंकीय समग्र सदस्य आईडी व 8-अंकीय परिवार आईडी दर्ज कर पारिवारिक विवरण सत्यापित करें।',
      'असंगठित श्रमिक श्रेणी (निर्माण, गिग/डिलीवरी, तेंदूपत्ता/मजदूर) चुनें और मोबाइल ओटीपी से आवेदन जमा करें।',
      'आवेदन क्रमांक सुरक्षित रखें; नगर निगम जोन या जनपद पंचायत के जांच अधिकारी द्वारा सत्यापन किया जाएगा।',
      'स्वीकृति के बाद sambal.mp.gov.in से डिजिटल संबल 2.0 कार्ड डाउनलोड कर शिक्षा, प्रसूति व सहायता लाभ पाएं।',
    ],
    stepsMalwi: [
      'सरकारी वेबसाइट sambal.mp.gov.in खोलो अने "पंजीयन हेतु आवेदन करें" पर दबावो।',
      'थारी 9 अंक री समग्र आईडी अने 8 अंक रो कुटुंब नंबर डाल ने परिवार री जानकारी जांचो।',
      'थारो मजूर कामकाज चुनो, घोषणा पर टिक लगावो अने मोबाइल ओटीपी सूं अर्जी जमा करो।',
      'अर्जी नंबर संभाल ने राखो; नगर निगम वार्ड या जनपद दफ्तर सूं जांच पूरी होवेगी।',
      'मंजूरी रा बाद sambal.mp.gov.in सूं संबल 2.0 कार्ड डाउनलोड कर लो अने सगळा लाभ पावो।',
    ],
  },
};

function buildGenericProcedure(scheme: Scheme): ApplicationProcedureInfo {
  const host = getOfficialPortalDisplayHost(scheme);
  const docsEn = scheme.requiredDocuments.map(id => getDocumentLabel(id, 'en')).join(', ');
  const docsHi = scheme.requiredDocuments.map(id => getDocumentLabel(id, 'hi')).join(', ');
  const docsMalwi = scheme.requiredDocuments.map(id => getDocumentLabel(id, 'malwi')).join(', ');

  const cscEn = scheme.cscAvailable ? ' / MPOnline & CSC Kiosk' : '';
  const cscHi = scheme.cscAvailable ? ' / एमपी ऑनलाइन एवं सीएससी कियोस्क' : '';
  const cscMalwi = scheme.cscAvailable ? ' / एमपी ऑनलाइन व सीएससी दुकान' : '';

  const levelModeMap: Record<
    Scheme['governanceLevel'],
    { en: string; hi: string; malwi: string; verifyEn: string; verifyHi: string; verifyMalwi: string; etaEn: string; etaHi: string; etaMalwi: string }
  > = {
    international: {
      en: `Official Portal (${host}) + Indore Project Nodal Cell${cscEn}`,
      hi: `आधिकारिक पोर्टल (${host}) + इंदौर परियोजना नोडल प्रकोष्ठ${cscHi}`,
      malwi: `सरकारी पोर्टल (${host}) + इंदौर परियोजना दफ्तर${cscMalwi}`,
      verifyEn: `Indore Project Implementation Unit (${scheme.nodalOfficeIndore}) verifies eligibility and site/beneficiary details.`,
      verifyHi: `इंदौर परियोजना इकाई (${scheme.nodalOfficeIndore}) द्वारा पात्रता व स्थलीय सत्यापन किया जाता है।`,
      verifyMalwi: `इंदौर परियोजना दफ्तर (${scheme.nodalOfficeIndore}) सूं पात्रता अने मौका जांच करी जावे छे।`,
      etaEn: '20–45 Days (Project Scrutiny & Approval)',
      etaHi: '20–45 दिन (परियोजना जांच व स्वीकृति)',
      etaMalwi: '20–45 दिन (जांच अने मंजूरी)',
    },
    national: {
      en: `Official Central Portal (${host})${cscEn}`,
      hi: `आधिकारिक केंद्रीय पोर्टल (${host})${cscHi}`,
      malwi: `केंद्र सरकार पोर्टल (${host})${cscMalwi}`,
      verifyEn: `District Nodal Authority (${scheme.nodalOfficeIndore}) scrutinizes documents and forwards for Central sanction.`,
      verifyHi: `जिला नोडल कार्यालय (${scheme.nodalOfficeIndore}) दस्तावेज़ों की जांच कर केंद्रीय स्वीकृति हेतु अग्रेषित करता है।`,
      verifyMalwi: `इंदौर जिला दफ्तर (${scheme.nodalOfficeIndore}) कागद री जांच कर ने केंद्र मंजूरी खातर आगे भेजे छे।`,
      etaEn: '15–30 Days (Central / District Verification)',
      etaHi: '15–30 दिन (केंद्रीय / जिला सत्यापन)',
      etaMalwi: '15–30 दिन (जिला अने केंद्र जांच)',
    },
    state_mp: {
      en: `MP State Portal (${host}) + Samagra e-KYC${cscEn}`,
      hi: `म.प्र. राज्य पोर्टल (${host}) + समग्र ई-केवाईसी${cscHi}`,
      malwi: `म.प्र. सरकार पोर्टल (${host}) + समग्र ई-केवाईसी${cscMalwi}`,
      verifyEn: `MP State Nodal Office in Indore (${scheme.nodalOfficeIndore}) verifies Samagra & domicile records before sanction.`,
      verifyHi: `इंदौर स्थित म.प्र. नोडल कार्यालय (${scheme.nodalOfficeIndore}) समग्र व मूल निवासी अभिलेख सत्यापित कर स्वीकृति देता है।`,
      verifyMalwi: `इंदौर रो म.प्र. नोडल दफ्तर (${scheme.nodalOfficeIndore}) समग्र अने मूल निवासी कागद जांच ने मंजूरी देवे छे।`,
      etaEn: '15–30 Days (Samagra & Department Scrutiny)',
      etaHi: '15–30 दिन (समग्र व विभागीय जांच)',
      etaMalwi: '15–30 दिन (समग्र अने विभाग री जांच)',
    },
    district_indore: {
      en: `Indore Collectorate Portal (${host}) / Lok Seva Kendra`,
      hi: `इंदौर कलेक्ट्रेट पोर्टल (${host}) / लोक सेवा केंद्र`,
      malwi: `इंदौर कलेक्टर पोर्टल (${host}) / लोक सेवा केंद्र`,
      verifyEn: `Indore Collectorate Nodal Cell (${scheme.nodalOfficeIndore}) reviews the application for District Collector sanction.`,
      verifyHi: `इंदौर कलेक्ट्रेट नोडल प्रकोष्ठ (${scheme.nodalOfficeIndore}) जिला कलेक्टर स्वीकृति हेतु आवेदन की जांच करता है।`,
      verifyMalwi: `इंदौर कलेक्टर दफ्तर (${scheme.nodalOfficeIndore}) अर्जी री जांच कर ने कलेक्टर मंजूरी करावे छे।`,
      etaEn: '7–21 Days (District Collectorate Fast-Track)',
      etaHi: '7–21 दिन (जिला कलेक्ट्रेट त्वरित स्वीकृति)',
      etaMalwi: '7–21 दिन (कलेक्टर दफ्तर सूं जल्दी मंजूरी)',
    },
    urban_imc: {
      en: `IMC Municipal Portal (${host}) / Ward 1–85 Zonal Office`,
      hi: `इंदौर नगर निगम पोर्टल (${host}) / वार्ड 1–85 जोनल कार्यालय`,
      malwi: `इंदौर नगर निगम पोर्टल (${host}) / वार्ड 1–85 जोन दफ्तर`,
      verifyEn: `IMC Zonal Officer & ${scheme.nodalOfficeIndore} conduct Ward-level verification in Indore.`,
      verifyHi: `इंदौर नगर निगम जोनल अधिकारी व ${scheme.nodalOfficeIndore} द्वारा वार्ड स्तर पर सत्यापन किया जाता है।`,
      verifyMalwi: `नगर निगम जोनल अफसर अने ${scheme.nodalOfficeIndore} सूं वार्ड स्तर पर जांच होवे छे।`,
      etaEn: '10–21 Days (IMC Zonal Verification)',
      etaHi: '10–21 दिन (नगर निगम जोनल सत्यापन)',
      etaMalwi: '10–21 दिन (नगर निगम जोन जांच)',
    },
    rural_janpad: {
      en: `MP Rural Portal (${host}) / Janpad Panchayat & Gram Sachiv`,
      hi: `म.प्र. ग्रामीण पोर्टल (${host}) / जनपद पंचायत व ग्राम सचिव`,
      malwi: `गाँव रो सरकारी पोर्टल (${host}) / जनपद पंचायत या ग्राम सचिव`,
      verifyEn: `Block Janpad Panchayat (Indore / Mhow / Sanwer / Depalpur) & ${scheme.nodalOfficeIndore} verify rural records.`,
      verifyHi: `जनपद पंचायत (इंदौर / महू / सांवेर / देपालपुर) एवं ${scheme.nodalOfficeIndore} ग्रामीण अभिलेख सत्यापित करते हैं।`,
      verifyMalwi: `जनपद पंचायत (इंदौर / महू / सांवेर / देपालपुर) अने ${scheme.nodalOfficeIndore} गाँव रा कागद जांचे छे।`,
      etaEn: '15–30 Days (Gram Panchayat & Janpad Verification)',
      etaHi: '15–30 दिन (ग्राम पंचायत व जनपद सत्यापन)',
      etaMalwi: '15–30 दिन (ग्राम पंचायत अने जनपद जांच)',
    },
  };

  const cfg = levelModeMap[scheme.governanceLevel];

  return {
    mode: cfg.en,
    modeHindi: cfg.hi,
    modeMalwi: cfg.malwi,
    estimatedTime: cfg.etaEn,
    estimatedTimeHindi: cfg.etaHi,
    estimatedTimeMalwi: cfg.etaMalwi,
    steps: [
      `Keep required documents ready (preferably verified in DigiLocker): ${docsEn || 'Aadhaar & Samagra ID'}.`,
      `Open the official verified government portal (${host}) or visit your nearest Indore ${scheme.cscAvailable ? 'MPOnline / CSC Kiosk or ' : ''}Nodal Office.`,
      `Complete citizen registration using your Aadhaar / 9-digit Samagra Member ID and fill the "${scheme.title}" application form accurately.`,
      cfg.verifyEn,
      `Save your Application Reference Number (ARN) to track status; approved benefit (${scheme.benefits}) is delivered directly via DBT or sanction order.`,
    ],
    stepsHindi: [
      `आवश्यक दस्तावेज़ तैयार रखें (संभव हो तो डिजिलॉकर से सत्यापित): ${docsHi || 'आधार व समग्र आईडी'}।`,
      `आधिकारिक सत्यापित सरकारी पोर्टल (${host}) खोलें या नजदीकी इंदौर ${scheme.cscAvailable ? 'एमपी ऑनलाइन / सीएससी केंद्र या ' : ''}नोडल कार्यालय जाएं।`,
      `आधार / 9-अंकीय समग्र सदस्य आईडी से पंजीकरण कर "${scheme.titleHindi}" आवेदन पत्र सही-सही भरें।`,
      cfg.verifyHi,
      `आवेदन पावती क्रमांक (ARN) सुरक्षित रखें; स्वीकृति के बाद लाभ (${scheme.benefitsHindi}) सीधे डीबीटी या स्वीकृति आदेश द्वारा प्रदान किया जाता है।`,
    ],
    stepsMalwi: [
      `जरूरी कागजात तैयार राखो (डिजिलॉकर सूं पक्का होवे तो और बढ़िया): ${docsMalwi || 'आधार अने समग्र नंबर'}।`,
      `असली सरकारी वेबसाइट (${host}) खोलो या नजदीकी इंदौर ${scheme.cscAvailable ? 'एमपी ऑनलाइन / सीएससी दुकान या ' : ''}दफ्तर जावो।`,
      `आधार / 9 अंक री समग्र आईडी सूं पंजीयन कर ने "${scheme.titleMalwi}" रो फॉर्म सही-सही भरो।`,
      cfg.verifyMalwi,
      `अर्जी री रसीद (ARN नंबर) संभाल ने राखो; मंजूरी मिल्या बाद लाभ सीधा बैंक खाता (DBT) या सरकारी आदेश सूं मिले छे।`,
    ],
  };
}

export function getSchemeApplicationProcedure(
  scheme: Scheme,
  lang: SupportedLanguage
): LocalizedApplicationProcedure {
  const portalUrl = resolveSchemePortalUrl(scheme);
  const portalHost = getOfficialPortalDisplayHost(scheme);
  const info: ApplicationProcedureInfo =
    scheme.applicationProcedure ||
    FLAGSHIP_PROCEDURES[scheme.id] ||
    buildGenericProcedure(scheme);

  return {
    portalUrl,
    portalHost,
    mode: pickText(lang, {
      en: info.mode,
      hi: info.modeHindi,
      malwi: info.modeMalwi,
    }),
    estimatedTime: pickText(lang, {
      en: info.estimatedTime,
      hi: info.estimatedTimeHindi,
      malwi: info.estimatedTimeMalwi,
    }),
    steps:
      lang === 'malwi'
        ? info.stepsMalwi
        : lang === 'hi'
        ? info.stepsHindi
        : info.steps,
    nodalOffice: scheme.nodalOfficeIndore,
    helpline: scheme.helpline,
  };
}
