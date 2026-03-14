const express = require('express');
const router = express.Router();

const dummyScheme = {
  id: 9999,
  title: 'National Student Merit Scholarship',
  slug: 'national-student-merit-scholarship',
  ministry: 'Ministry of Education',
  level: 'central',
  state: 'All States',
  scheme_category: ['Education', 'Scholarship'],
  tags: ['student', 'merit', 'scholarship', 'higher education'],
  target_beneficiaries: ['Students', 'Youth'],
  brief_description: 'A central government scholarship for meritorious students pursuing higher education in recognized universities.',
  description: `The National Student Merit Scholarship (NSMS) is a flagship initiative of the Ministry of Education, Government of India, designed to recognize and reward academic excellence among students from economically weaker sections of society. Launched with the vision of ensuring that financial constraints do not become a barrier to quality higher education, this scheme provides sustained financial support to deserving students throughout their undergraduate and postgraduate studies.

The scheme operates through the National Scholarship Portal (NSP), a unified digital platform that streamlines the application, verification, and disbursement process. Funds are transferred directly to the beneficiary's Aadhaar-linked bank account through the Direct Benefit Transfer (DBT) mechanism, ensuring transparency and eliminating middlemen.

Since its inception, the NSMS has benefited over 12 lakh students across India, with a special focus on students from rural areas, first-generation learners, and those belonging to marginalized communities. The scheme is renewed annually subject to the student maintaining the required academic performance, ensuring continued motivation and accountability.

State governments and union territories actively participate in the scheme by nominating eligible candidates through their respective education departments, making it a truly collaborative effort between the central and state governments to democratize access to higher education in India.`,

  eligibility_criteria: `1. The applicant must be a citizen of India.\n2. Must be enrolled full-time in a recognized university or college affiliated to a UGC-approved institution.\n3. Minimum age: 17 years. Maximum age: 25 years at the time of application.\n4. Annual family income from all sources must not exceed ₹2,50,000.\n5. Must have scored a minimum of 60% marks (55% for SC/ST/OBC/PwD candidates) in the last qualifying examination.\n6. The applicant must not be availing any other central government scholarship simultaneously.\n7. Must have a valid Aadhaar number linked to an active bank account.\n8. Gap year students are not eligible unless the gap was due to medical reasons supported by a certificate.`,

  benefits: `Financial Assistance:\n- Monthly stipend of ₹2,000 for undergraduate (UG) students\n- Monthly stipend of ₹3,000 for postgraduate (PG) students\n- One-time book and stationery grant of ₹5,000 per academic year\n- Laptop assistance of ₹15,000 (one-time, for students without a personal computer)\n\nAdditional Support:\n- Tuition fee reimbursement up to ₹20,000 per year for students in professional courses (Engineering, Medical, Law)\n- Hostel allowance of ₹1,000/month for students residing in government-approved hostels outside their home district\n- Special disability allowance of ₹500/month for PwD scholars\n\nRecognition:\n- Certificate of Merit issued by the Ministry of Education upon successful completion of the course\n- Priority consideration for government internship programs and fellowship opportunities\n- Alumni network access for career guidance and mentorship`,
  application_process: '1. Visit the National Scholarship Portal (scholarships.gov.in)\n2. Register with Aadhaar number\n3. Fill in academic and income details\n4. Upload required documents\n5. Submit before the deadline',
  required_documents: 'Aadhaar Card\nIncome Certificate\nMarksheet of last qualifying exam\nBank account details\nAdmission letter from university',
  application_url: 'https://scholarships.gov.in',
  reference_links: 'National Scholarship Portal: https://scholarships.gov.in\nMinistry of Education: https://education.gov.in',
  contact_information: {
    helpline: '1800-11-2199',
    email: 'helpdesk@nsp.gov.in',
    website: 'https://scholarships.gov.in'
  },
  last_updated: '2026-01-15',
  is_active: 1
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Testing route is working',
    data: { scheme: dummyScheme }
  });
});

module.exports = router;
