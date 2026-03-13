#!/usr/bin/env python3
"""
Comprehensive MyScheme Crawler - Extracts ALL available data fields
Based on the complete API structure discovered in network tab analysis.
"""

import asyncio
import aiohttp
import sqlite3
import logging
import json
import os
import re
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ComprehensiveMySchemeCrawler:
    def __init__(self, db_path: str = "comprehensive_schemes.db"):
        self.db_path = db_path
        self.session = None
        self.api_key = os.getenv("MYSCHEME_API_KEY")
        self.enhanced_count = 0
        self.failed_count = 0
        
        if not self.api_key:
            raise ValueError("MYSCHEME_API_KEY not found in .env file")
            
        self.init_database()
        
    def init_database(self):
        """Initialize comprehensive database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS comprehensive_schemes (
            id TEXT PRIMARY KEY,
            slug TEXT,
            name TEXT,
            short_title TEXT,
            ministry TEXT,
            department TEXT,
            implementing_agency TEXT,
            level TEXT,
            scheme_for TEXT,
            dbt_scheme BOOLEAN,
            
            -- Content fields
            brief_description TEXT,
            detailed_description TEXT,
            detailed_description_md TEXT,
            
            -- Eligibility and criteria
            eligibility_criteria TEXT,
            eligibility_criteria_md TEXT,
            
            -- Benefits and financial info
            benefits TEXT,
            benefit_type TEXT,
            exclusions TEXT,
            
            -- Application process
            application_process TEXT,
            application_mode TEXT,
            application_url TEXT,
            
            -- Documents and requirements
            required_documents TEXT,
            scheme_definitions TEXT,
            
            -- Contact and references
            contact_information TEXT,
            reference_links TEXT,
            official_website TEXT,
            scheme_image_url TEXT,
            
            -- Categorization
            tags TEXT,
            target_beneficiaries TEXT,
            scheme_category TEXT,
            scheme_subcategory TEXT,
            
            -- Dates
            scheme_open_date TEXT,
            scheme_close_date TEXT,
            
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        conn.commit()
        conn.close()
        logging.info("Comprehensive database initialized successfully")
        
    async def __aenter__(self):
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Api-Key': self.api_key,
            'Accept': 'application/json',
            'Origin': 'https://www.myscheme.gov.in'
        }
        
        self.session = aiohttp.ClientSession(
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def fetch_all_scheme_slugs(self) -> List[tuple]:
        """Fetch all scheme slugs directly from MyScheme search API."""
        logging.info("Fetching scheme list from MyScheme search API...")
        
        schemes = []
        page = 0
        size = 50  # Larger page size for efficiency
        
        while True:
            url = f"https://api.myscheme.gov.in/search/v6/schemes?lang=en&q=[]&keyword=&sort=&from={page * size}&size={size}"
            
            try:
                await asyncio.sleep(0.5)  # Rate limiting
                
                async with self.session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if 'data' in data and 'hits' in data['data']:
                            hits = data['data']['hits']
                            items = hits.get('items', [])
                            
                            if not items:
                                break  # No more schemes
                            
                            for item in items:
                                scheme_id = item.get('id', '')
                                fields = item.get('fields', {})
                                slug = fields.get('slug', '')
                                name = fields.get('schemeName', '')
                                
                                if scheme_id and slug and name:
                                    schemes.append((scheme_id, slug, name))
                            
                            logging.info(f"Fetched page {page + 1}, got {len(items)} schemes (total: {len(schemes)})")
                            
                            # Check if we've reached the end
                            page_info = hits.get('page', {})
                            total_pages = page_info.get('totalPages', 0)
                            
                            if page + 1 >= total_pages:
                                break
                                
                            page += 1
                        else:
                            logging.error(f"Unexpected API response structure on page {page}")
                            break
                    else:
                        logging.error(f"API error on page {page}: {response.status}")
                        break
                        
            except Exception as e:
                logging.error(f"Exception fetching page {page}: {e}")
                break
        
        logging.info(f"Total schemes found: {len(schemes)}")
        return schemes
        
    def extract_text_from_structured(self, structured_data: List[Dict]) -> str:
        """Extract plain text from MyScheme's structured content format."""
        if not structured_data:
            return ""
            
        text_parts = []
        
        for item in structured_data:
            if item.get('type') == 'paragraph':
                children = item.get('children', [])
                for child in children:
                    if 'text' in child:
                        text_parts.append(child['text'])
                        
            elif item.get('type') in ['ol_list', 'ul_list']:
                children = item.get('children', [])
                for list_item in children:
                    if list_item.get('type') == 'list_item':
                        item_children = list_item.get('children', [])
                        for child in item_children:
                            if 'text' in child:
                                text_parts.append(f"• {child['text']}")
                                
        return '\n'.join(text_parts).strip()
        
    def extract_documents_from_text(self, text: str) -> str:
        """Extract document requirements from application process text."""
        if not text:
            return ""
            
        # Look for document-related sentences
        doc_keywords = ['documents', 'certificate', 'proof', 'copy', 'upload', 'attach', 'submit']
        found_docs = []
        
        sentences = re.split(r'[.!?]', text)
        for sentence in sentences:
            sentence = sentence.strip()
            if any(keyword.lower() in sentence.lower() for keyword in doc_keywords):
                if len(sentence) > 10 and len(sentence) < 200:  # Reasonable length
                    found_docs.append(sentence)
        
        return '\n'.join(list(set(found_docs))[:5])  # Top 5 unique sentences
        
    def extract_contact_info(self, text: str) -> Dict[str, str]:
        """Extract contact information from text."""
        if not text:
            return {}
            
        contact_info = {}
        
        # Phone numbers
        phone_pattern = r'(\+91[-\s]?[6-9]\d{9}|[6-9]\d{9})'
        phones = re.findall(phone_pattern, text)
        if phones:
            contact_info['phone'] = phones[0]
        
        # Email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        if emails:
            contact_info['email'] = emails[0]
        
        return contact_info
        
    async def fetch_scheme_details(self, slug: str) -> Optional[Dict[str, Any]]:
        """Fetch detailed scheme information using the correct API."""
        url = f"https://api.myscheme.gov.in/schemes/v6/public/schemes?slug={slug}&lang=en"
        
        try:
            await asyncio.sleep(1)  # Rate limiting
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if 'data' in data and 'en' in data['data']:
                        return data['data']['en']
                    else:
                        logging.warning(f"Unexpected response structure for slug {slug}")
                        return None
                        
                elif response.status == 404:
                    logging.warning(f"Scheme not found: {slug}")
                    return None
                else:
                    logging.error(f"API error for {slug}: {response.status}")
                    return None
                    
        except Exception as e:
            logging.error(f"Exception fetching {slug}: {e}")
            return None
            
    def process_comprehensive_scheme_data(self, scheme_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and extract ALL available fields from API response."""
        basic_details = scheme_data.get('basicDetails', {})
        scheme_content = scheme_data.get('schemeContent', {})
        eligibility = scheme_data.get('eligibilityCriteria', {})
        app_process = scheme_data.get('applicationProcess', [])
        definitions = scheme_data.get('schemeDefinitions', [])
        
        # Extract basic information with safe defaults
        processed = {
            'name': basic_details.get('schemeName', ''),
            'short_title': basic_details.get('schemeShortTitle', ''),
            'ministry': basic_details.get('nodalMinistryName', {}).get('label', '') if basic_details.get('nodalMinistryName') else '',
            'department': basic_details.get('nodalDepartmentName', {}).get('label', '') if basic_details.get('nodalDepartmentName') else '',
            'implementing_agency': basic_details.get('implementingAgency', ''),
            'level': basic_details.get('level', {}).get('label', '') if basic_details.get('level') else '',
            'scheme_for': basic_details.get('schemeFor', ''),
            'dbt_scheme': basic_details.get('dbtScheme', False),
            'scheme_open_date': basic_details.get('schemeOpenDate'),
            'scheme_close_date': basic_details.get('schemeCloseDate'),
            'tags': json.dumps(basic_details.get('tags', [])),
            'target_beneficiaries': json.dumps(basic_details.get('targetBeneficiaries', [])),
            'scheme_category': json.dumps(basic_details.get('schemeCategory', [])),
            'scheme_subcategory': json.dumps(basic_details.get('schemeSubCategory', [])),
        }
        
        # Extract content with safe defaults
        processed['brief_description'] = scheme_content.get('briefDescription', '')
        processed['detailed_description_md'] = scheme_content.get('detailedDescription_md', '')
        processed['scheme_image_url'] = scheme_content.get('schemeImageUrl', '')
        processed['benefit_type'] = scheme_content.get('benefitTypes', {}).get('label', '') if scheme_content.get('benefitTypes') else ''
        
        # Extract structured content
        processed['detailed_description'] = self.extract_text_from_structured(scheme_content.get('detailedDescription', []))
        processed['benefits'] = self.extract_text_from_structured(scheme_content.get('benefits', []))
        processed['exclusions'] = self.extract_text_from_structured(scheme_content.get('exclusions', []))
        
        # Extract eligibility
        processed['eligibility_criteria_md'] = eligibility.get('eligibilityDescription_md', '')
        processed['eligibility_criteria'] = self.extract_text_from_structured(eligibility.get('eligibilityDescription', []))
        
        # Extract application process
        if app_process:
            app_info = app_process[0]
            processed['application_mode'] = app_info.get('mode', '')
            processed['application_url'] = app_info.get('url', '')
            processed['application_process'] = self.extract_text_from_structured(app_info.get('process', []))
            
            # Extract documents from application process
            process_text = processed['application_process']
            processed['required_documents'] = self.extract_documents_from_text(process_text)
        
        # Extract scheme definitions
        if definitions:
            def_text = []
            for defn in definitions:
                name = defn.get('name', '')
                definition = self.extract_text_from_structured(defn.get('definition', []))
                source = defn.get('source', '')
                def_text.append(f"{name}: {definition}")
                if source:
                    def_text.append(f"Source: {source}")
            processed['scheme_definitions'] = '\n'.join(def_text)
        
        # Extract references
        references = scheme_content.get('references', [])
        if references:
            ref_text = []
            for ref in references:
                title = ref.get('title', '')
                url = ref.get('url', '')
                if title and url:
                    ref_text.append(f"{title}: {url}")
            processed['reference_links'] = '\n'.join(ref_text)
        
        # Extract contact information from all text sources
        all_text = ' '.join([
            processed.get('detailed_description', ''),
            processed.get('eligibility_criteria', ''),
            processed.get('application_process', ''),
            processed.get('scheme_definitions', '')
        ])
        
        contact_info = self.extract_contact_info(all_text)
        if contact_info:
            processed['contact_information'] = json.dumps(contact_info)
        
        return processed
        
    def save_comprehensive_scheme(self, scheme_id: str, slug: str, processed_data: Dict[str, Any]):
        """Save comprehensive scheme data to database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Prepare data for insertion
        data = {
            'id': scheme_id,
            'slug': slug,
            **processed_data
        }
        
        # Insert or replace
        placeholders = ', '.join(['?' for _ in data])
        columns = ', '.join(data.keys())
        values = list(data.values())
        
        cursor.execute(f"""
        INSERT OR REPLACE INTO comprehensive_schemes ({columns})
        VALUES ({placeholders})
        """, values)
        
        conn.commit()
        conn.close()
        
    async def enhance_schemes(self, max_schemes: int = None):
        """Main method to enhance schemes with comprehensive data."""
        schemes = await self.fetch_all_scheme_slugs()
        
        if max_schemes:
            schemes = schemes[:max_schemes]
        
        # Check which schemes are already enhanced
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT slug FROM comprehensive_schemes WHERE detailed_description IS NOT NULL AND detailed_description != ''")
        enhanced_slugs = set(row[0] for row in cursor.fetchall())
        conn.close()
        
        # Filter out already enhanced schemes
        remaining_schemes = [(sid, slug, name) for sid, slug, name in schemes if slug not in enhanced_slugs]
        
        logging.info(f"Total schemes: {len(schemes)}")
        logging.info(f"Already enhanced: {len(enhanced_slugs)}")
        logging.info(f"Remaining to enhance: {len(remaining_schemes)}")
        
        if not remaining_schemes:
            logging.info("All schemes already enhanced!")
            return
        
        logging.info(f"Starting comprehensive enhancement of {len(remaining_schemes)} remaining schemes")
        
        for i, (scheme_id, slug, name) in enumerate(remaining_schemes, 1):
            logging.info(f"[{i}/{len(remaining_schemes)}] Processing: {name[:50]}... (slug: {slug})")
            
            # Fetch detailed data
            scheme_data = await self.fetch_scheme_details(slug)
            
            if scheme_data:
                try:
                    # Process and save
                    processed_data = self.process_comprehensive_scheme_data(scheme_data)
                    self.save_comprehensive_scheme(scheme_id, slug, processed_data)
                    
                    self.enhanced_count += 1
                    logging.info(f"✅ Comprehensively enhanced: {name[:50]}...")
                    
                except Exception as e:
                    logging.error(f"❌ Error processing {name}: {e}")
                    self.failed_count += 1
            else:
                self.failed_count += 1
                logging.warning(f"❌ Failed to fetch: {name[:50]}...")
                
        logging.info(f"""
        🎯 Comprehensive Enhancement Complete:
        ✅ Successfully enhanced: {self.enhanced_count}
        ❌ Failed: {self.failed_count}
        📊 Success rate: {(self.enhanced_count/(self.enhanced_count+self.failed_count)*100):.1f}%
        """)

async def main():
    """Run the comprehensive MyScheme crawler."""
    async with ComprehensiveMySchemeCrawler() as crawler:
        # Run full dataset from beginning
        await crawler.enhance_schemes()

if __name__ == "__main__":
    asyncio.run(main())