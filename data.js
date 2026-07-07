const ENGINES = {
  google:    'https://www.google.com/search?q=',
  bing:      'https://www.bing.com/search?q=',
  duckduckgo:'https://duckduckgo.com/?q=',
  yandex:    'https://yandex.com/search/?text=',
  shodan:    'https://www.shodan.io/search?query=',
  censys:    'https://search.censys.io/search?resource=hosts&q='
};

const OPERATORS = [
  { op: 'site:',        desc: 'Restrict results to a specific domain or subdomain', ex: 'site:example.com' },
  { op: 'filetype:',    desc: 'Filter results by file format (pdf, docx, xlsx, pptx, csv, txt)', ex: 'filetype:pdf' },
  { op: 'ext:',         desc: 'Search by file extension (alternative to filetype:)', ex: 'ext:pdf' },
  { op: 'inurl:',       desc: 'Find pages with the term somewhere in the URL path', ex: 'inurl:admin' },
  { op: 'intitle:',     desc: 'Find pages with the term in the HTML title tag', ex: 'intitle:"index of"' },
  { op: 'intext:',      desc: 'Find pages with the term in the visible body text', ex: 'intext:password' },
  { op: 'cache:',       desc: 'Show Google\'s cached version of a page', ex: 'cache:example.com' },
  { op: 'related:',     desc: 'Find pages related to a given URL', ex: 'related:example.com' },
  { op: '"exact phrase"', desc: 'Match the exact phrase word-for-word', ex: '"security report 2025"' },
  { op: 'OR',           desc: 'Match either term (logical OR)', ex: 'linux OR windows' },
  { op: '-keyword',     desc: 'Exclude results containing a term', ex: '-tutorial -youtube' },
  { op: 'wildcard *',   desc: 'Match any word at the asterisk position', ex: '"ceh v* study guide"' },
  { op: 'grouping ()',  desc: 'Group operators for complex queries', ex: '(red team OR blue team) guide' }
];

const SAMPLE_TARGETS = [
  'ceh v13', 'linux tutorial', 'example.com', 'openai report', 'cybersecurity notes',
  'python guide', 'cloud security whitepaper', 'windows forensic notes',
  'owasp top 10', 'network traffic analysis', 'digital forensics tools',
  'penetration testing methodology', 'threat intelligence platform',
  'api security best practices', 'container security guide'
];

const MODE_DEFINITIONS = {
  precision: {
    label: 'Precision',
    desc: 'High-quality focused queries using exact phrase, OR, exclude, title, URL, and filetype operators. Best for targeted public document discovery.',
    type_filter: ['broad','exact'],
    base_patterns: ['exact','broad','filetype','intitle','inurl']
  },
  deep_search: {
    label: 'Deep Search',
    desc: 'Stronger multi-operator combinations combining intitle, inurl, intext, filetype, site, OR, exclusion, and date filters. For deep-dive public research.',
    type_filter: ['advanced','domain'],
    base_patterns: ['exact','intitle+inurl','filetype-or','site-edu-org','date-filter','exclude-social']
  },
  document_hunt: {
    label: 'Document Hunt',
    desc: 'Specialized in locating public documents across formats: pdf, doc, docx, ppt, pptx, xls, xlsx, csv, txt. Finds reports, whitepapers, and data files.',
    type_filter: ['document'],
    base_patterns: ['pdf','word','ppt','xls','csv','txt','multi-format']
  },
  domain_recon: {
    label: 'Domain Recon',
    desc: 'Site-scoped reconnaissance for a known domain. Generates site: queries to map all indexed pages, directories, and content categories.',
    type_filter: ['domain'],
    base_patterns: ['site-all','site-pdf','site-docs','site-blog','site-contact','site-legal']
  },
  code_intel: {
    label: 'Code Intel',
    desc: 'Public code and repository intelligence search. Locates GitHub/GitLab repositories, documentation, API references, and open-source projects.',
    type_filter: ['broad','exact'],
    base_patterns: ['github','gitlab','docs','repo','stackoverflow','package']
  },
  mentions_intel: {
    label: 'Mentions Intel',
    desc: 'Public mentions, news coverage, community discussions, and social signals. Tracks press releases, reports, forum threads, and platform discussions.',
    type_filter: ['broad','exact'],
    base_patterns: ['news','press-release','reddit','stackoverflow','medium','announcement']
  }
};

const MODE_TO_CATEGORY = {
  precision:      null,
  deep_search:    null,
  document_hunt:  'documents',
  domain_recon:   'domain_research',
  code_intel:     'code_research',
  mentions_intel: 'news_mentions'
};

const CATEGORIES = {
  documents: {
    label: 'Documents',
    templates: [
      { t: '"{{target}}" filetype:pdf', title: 'PDF Documents', p: 'Find public PDF documents', type: 'document', s: 'high' },
      { t: '"{{target}}" filetype:doc OR filetype:docx', title: 'Word Documents', p: 'Find Word document files', type: 'document', s: 'high' },
      { t: '"{{target}}" filetype:ppt OR filetype:pptx', title: 'Presentations', p: 'Find PowerPoint presentations', type: 'document', s: 'high' },
      { t: '"{{target}}" filetype:xls OR filetype:xlsx', title: 'Spreadsheets', p: 'Find Excel spreadsheets', type: 'document', s: 'high' },
      { t: 'inurl:pdf "{{target}}"', title: 'URL PDF Search', p: 'PDF files with target in the URL', type: 'advanced', s: 'high' },
      { t: 'intitle:"{{target}}" filetype:pdf', title: 'Title + PDF', p: 'PDFs with target in the page title', type: 'advanced', s: 'high' },
      { t: '"{{target}}" (report OR whitepaper OR paper)', title: 'Reports & Whitepapers', p: 'Published reports and whitepapers', type: 'exact', s: 'medium' },
      { t: '"{{target}}" filetype:txt OR filetype:csv', title: 'Text & CSV Files', p: 'Find text and data files', type: 'document', s: 'medium' },
      { t: '"{{target}}" (guide OR manual OR handbook)', title: 'Guides & Manuals', p: 'Find user guides and manuals', type: 'exact', s: 'medium' },
      { t: 'ext:pdf "{{target}}" "report"', title: 'PDF Reports', p: 'Find PDF reports specifically', type: 'advanced', s: 'high' },
      { t: '"{{target}}" filetype:pdf OR filetype:doc OR filetype:ppt OR filetype:xls', title: 'All Document Types', p: 'Documents across all formats', type: 'document', s: 'high' }
    ]
  },
  public_directories: {
    label: 'Public Directories',
    templates: [
      { t: 'intitle:"index of" "{{target}}"', title: 'Index Of', p: 'Find public directory listings', type: 'advanced', s: 'medium' },
      { t: 'intitle:"index of" "{{target}}" filetype:pdf', title: 'Index Of PDF', p: 'Directories containing PDF files', type: 'advanced', s: 'medium' },
      { t: 'inurl:files "{{target}}"', title: 'Files Directory', p: 'Pages with a files directory', type: 'advanced', s: 'medium' },
      { t: 'inurl:downloads "{{target}}"', title: 'Downloads Directory', p: 'Pages with downloads directory', type: 'advanced', s: 'medium' },
      { t: 'inurl:documents "{{target}}"', title: 'Documents Directory', p: 'Pages with documents directory', type: 'advanced', s: 'medium' },
      { t: 'inurl:backup "{{target}}"', title: 'Backup Files', p: 'Find exposed backup directories', type: 'advanced', s: 'medium' },
      { t: 'intitle:"index of" {{target}} filetype:txt', title: 'Index Of TXT', p: 'Directory listings with text files', type: 'advanced', s: 'medium' },
      { t: '"{{target}}" "parent directory"', title: 'Parent Directory', p: 'Pages with parent directory references', type: 'advanced', s: 'medium' },
      { t: '"{{target}}" "directory listing"', title: 'Directory Listing', p: 'Pages with directory listings enabled', type: 'advanced', s: 'medium' },
      { t: 'inurl:upload "{{target}}"', title: 'Upload Directories', p: 'Find file upload directories', type: 'advanced', s: 'medium' },
      { t: 'inurl:admin "{{target}}"', title: 'Admin Directories', p: 'Find admin or restricted directories', type: 'advanced', s: 'medium' }
    ]
  },
  domain_research: {
    label: 'Domain Research',
    templates: [
      { t: 'site:{{domain}}', title: 'All Indexed Pages', p: 'View all publicly indexed pages on this domain', type: 'domain', s: 'low' },
      { t: 'site:{{domain}} "{{keyword}}"', title: 'Keyword on Domain', p: 'Pages matching keyword on this domain', type: 'domain', s: 'low' },
      { t: 'site:{{domain}} filetype:pdf', title: 'PDF Files on Domain', p: 'PDF documents hosted on the domain', type: 'document', s: 'high' },
      { t: 'site:{{domain}} inurl:docs', title: 'Documentation Pages', p: 'Documentation and help pages on the domain', type: 'domain', s: 'medium' },
      { t: 'site:{{domain}} inurl:blog OR inurl:news', title: 'Blog & News', p: 'Blog and news content on the domain', type: 'domain', s: 'medium' },
      { t: 'site:{{domain}} inurl:careers OR inurl:jobs', title: 'Careers', p: 'Career and job listing pages', type: 'domain', s: 'medium' },
      { t: 'site:{{domain}} "contact"', title: 'Contact Pages', p: 'Contact information pages', type: 'domain', s: 'low' },
      { t: 'site:{{domain}} "about"', title: 'About Pages', p: 'About us and company pages', type: 'domain', s: 'low' },
      { t: 'site:{{domain}} "privacy policy" OR "terms of service"', title: 'Legal Pages', p: 'Privacy policy and terms pages', type: 'domain', s: 'medium' },
      { t: 'site:{{domain}} intitle:"{{keyword}}"', title: 'Title Match on Domain', p: 'Pages with keyword in the title', type: 'advanced', s: 'medium' },
      { t: 'site:{{domain}} inurl:faq', title: 'FAQ Pages', p: 'Frequently asked questions pages', type: 'domain', s: 'medium' }
    ]
  },
  company_research: {
    label: 'Company Research',
    templates: [
      { t: '"{{target}}" "about us"', title: 'About Us', p: 'Find about us and company description pages', type: 'exact', s: 'low' },
      { t: '"{{target}}" "press release"', title: 'Press Releases', p: 'Find official press releases and announcements', type: 'exact', s: 'low' },
      { t: '"{{target}}" "annual report"', title: 'Annual Reports', p: 'Find annual financial and sustainability reports', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "leadership" OR "management"', title: 'Leadership', p: 'Find executive leadership and management pages', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "careers" OR "jobs"', title: 'Careers', p: 'Find careers and job listing pages', type: 'exact', s: 'low' },
      { t: '"{{target}}" "contact us" OR "contact"', title: 'Contact', p: 'Find contact information and office locations', type: 'exact', s: 'low' },
      { t: '"{{target}}" site:linkedin.com', title: 'LinkedIn Company', p: 'Find the company LinkedIn profile', type: 'domain', s: 'medium' },
      { t: '"{{target}}" "partners" OR "partnership"', title: 'Partners', p: 'Find partner and alliance information', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "investor" OR "investors"', title: 'Investors', p: 'Find investor relations information', type: 'exact', s: 'medium' },
      { t: '"{{target}}" company OR enterprise OR organization', title: 'Company Profile', p: 'Broad company profile search', type: 'broad', s: 'low' },
      { t: '"{{target}}" "news" OR "announcement"', title: 'Company News', p: 'Find company news and announcements', type: 'broad', s: 'low' }
    ]
  },
  code_research: {
    label: 'Code Research',
    templates: [
      { t: 'site:github.com "{{target}}"', title: 'GitHub Repositories', p: 'Find public GitHub repositories', type: 'domain', s: 'medium' },
      { t: 'site:gitlab.com "{{target}}"', title: 'GitLab Repositories', p: 'Find public GitLab repositories', type: 'domain', s: 'medium' },
      { t: '"{{target}}" "documentation"', title: 'Documentation', p: 'Find API and project documentation', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "repository"', title: 'Repository', p: 'Find code repositories and source hosting', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "example code" OR "examples"', title: 'Example Code', p: 'Find code examples and usage samples', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "open source"', title: 'Open Source', p: 'Find open-source projects and contributions', type: 'exact', s: 'medium' },
      { t: 'site:stackoverflow.com "{{target}}"', title: 'Stack Overflow', p: 'Find technical discussions and Q&A', type: 'domain', s: 'medium' },
      { t: '"{{target}}" API OR SDK OR library OR framework', title: 'API & Libraries', p: 'Find API references and libraries', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "npm" OR "pip" OR "gem" OR "maven"', title: 'Package Registries', p: 'Find package manager references', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "readme" OR "getting started"', title: 'README & Getting Started', p: 'Find project README and getting started guides', type: 'exact', s: 'low' },
      { t: 'site:bitbucket.org "{{target}}"', title: 'Bitbucket Repos', p: 'Find public Bitbucket repositories', type: 'domain', s: 'medium' }
    ]
  },
  news_mentions: {
    label: 'News & Mentions',
    templates: [
      { t: '"{{target}}" news', title: 'General News', p: 'Find general news about the target', type: 'broad', s: 'low' },
      { t: '"{{target}}" latest', title: 'Latest Updates', p: 'Find the most recent updates and coverage', type: 'broad', s: 'low' },
      { t: '"{{target}}" "press release"', title: 'Press Releases', p: 'Find official press release announcements', type: 'exact', s: 'low' },
      { t: '"{{target}}" "announcement"', title: 'Announcements', p: 'Find public announcements', type: 'exact', s: 'low' },
      { t: '"{{target}}" site:news.google.com', title: 'Google News', p: 'Find Google News indexed articles', type: 'domain', s: 'low' },
      { t: '"{{target}}" report OR coverage OR update', title: 'News Coverage', p: 'Find in-depth news coverage and reports', type: 'broad', s: 'low' },
      { t: '"{{target}}" "interview" OR "feature"', title: 'Interviews & Features', p: 'Find interviews and feature articles', type: 'exact', s: 'low' },
      { t: '"{{target}}" "podcast" OR "webinar"', title: 'Podcasts & Webinars', p: 'Find podcast episodes and webinar recordings', type: 'exact', s: 'low' },
      { t: '"{{target}}" site:reuters.com OR site:bloomberg.com OR site:wsj.com', title: 'Major News Outlets', p: 'Find coverage from major news agencies', type: 'domain', s: 'low' },
      { t: '"{{target}}" 2025 OR 2026', title: 'Recent (2025-2026)', p: 'Find recent news articles from 2025-2026', type: 'broad', s: 'low' },
      { t: '"{{target}}" "Q4" OR "Q1" OR "quarterly"', title: 'Quarterly Reports', p: 'Find quarterly business reports', type: 'exact', s: 'medium' }
    ]
  },
  forums_discussions: {
    label: 'Forums & Discussions',
    templates: [
      { t: '"{{target}}" site:reddit.com', title: 'Reddit Discussions', p: 'Find Reddit discussions and threads', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:stackoverflow.com', title: 'Stack Overflow', p: 'Find technical discussions on Stack Overflow', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:medium.com', title: 'Medium Articles', p: 'Find Medium blog posts and articles', type: 'domain', s: 'low' },
      { t: '"{{target}}" "forum"', title: 'Forum Posts', p: 'Find forum discussions and threads', type: 'exact', s: 'low' },
      { t: '"{{target}}" "discussion" OR "thread"', title: 'Discussions', p: 'Find community discussion threads', type: 'exact', s: 'low' },
      { t: '"{{target}}" "community"', title: 'Community Posts', p: 'Find community-generated content', type: 'exact', s: 'low' },
      { t: '"{{target}}" site:quora.com', title: 'Quora Answers', p: 'Find Quora questions and answers', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:dev.to', title: 'Dev.to Articles', p: 'Find developer community articles', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:news.ycombinator.com', title: 'Hacker News', p: 'Find Hacker News discussions', type: 'domain', s: 'low' },
      { t: '"{{target}}" "review" OR "rating"', title: 'Reviews & Ratings', p: 'Find user reviews and ratings', type: 'exact', s: 'low' },
      { t: '"{{target}}" "AMA" OR "ask me anything"', title: 'AMA Threads', p: 'Find Ask Me Anything threads', type: 'exact', s: 'low' }
    ]
  },
  public_profiles: {
    label: 'Public Profiles',
    templates: [
      { t: '"{{target}}" site:linkedin.com', title: 'LinkedIn Profiles', p: 'Find professional LinkedIn profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:twitter.com OR site:x.com', title: 'Twitter/X Profiles', p: 'Find Twitter and X social profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:facebook.com', title: 'Facebook Profiles', p: 'Find Facebook public profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:instagram.com', title: 'Instagram Profiles', p: 'Find Instagram public profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" "profile"', title: 'General Profile', p: 'Find general public profiles across platforms', type: 'broad', s: 'low' },
      { t: '"{{target}}" resume OR CV OR portfolio', title: 'Resume / CV', p: 'Find resumes and professional portfolios', type: 'broad', s: 'medium' },
      { t: '"{{target}}" site:github.com', title: 'GitHub Profile', p: 'Find developer GitHub profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:behance.net OR site:dribbble.com', title: 'Design Portfolios', p: 'Find design portfolios on Behance and Dribbble', type: 'domain', s: 'low' },
      { t: '"{{target}}" site:medium.com/@', title: 'Medium Profile', p: 'Find Medium writer profiles', type: 'domain', s: 'low' },
      { t: '"{{target}}" "about me" OR "about" site:linkedin.com', title: 'LinkedIn About', p: 'Find LinkedIn about sections', type: 'advanced', s: 'medium' },
      { t: '"{{target}}" site:keybase.io', title: 'Keybase Profile', p: 'Find Keybase identity profiles', type: 'domain', s: 'low' }
    ]
  },
  technical_docs: {
    label: 'Technical Docs',
    templates: [
      { t: '"{{target}}" "documentation"', title: 'Documentation', p: 'Find official technical documentation', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "docs"', title: 'Docs Pages', p: 'Find documentation section pages', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "manual"', title: 'User Manual', p: 'Find user and reference manuals', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "reference"', title: 'Reference Guide', p: 'Find technical reference materials', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "configuration guide"', title: 'Configuration Guide', p: 'Find configuration and setup guides', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "API reference" OR "API docs"', title: 'API Reference', p: 'Find API documentation and endpoints', type: 'exact', s: 'high' },
      { t: '"{{target}}" filetype:pdf "guide"', title: 'PDF Guides', p: 'Find guide-style PDF documents', type: 'document', s: 'high' },
      { t: '"{{target}}" site:readthedocs.io', title: 'Read the Docs', p: 'Find documentation hosted on Read the Docs', type: 'domain', s: 'medium' },
      { t: '"{{target}}" "getting started"', title: 'Getting Started', p: 'Find getting started and quickstart guides', type: 'exact', s: 'low' },
      { t: '"{{target}}" "troubleshooting"', title: 'Troubleshooting', p: 'Find troubleshooting and FAQ resources', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "best practices"', title: 'Best Practices', p: 'Find best practice guides and recommendations', type: 'exact', s: 'medium' }
    ]
  },
  reports: {
    label: 'Reports',
    templates: [
      { t: '"{{target}}" "report"', title: 'General Reports', p: 'Find reports related to the target', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "whitepaper"', title: 'Whitepapers', p: 'Find industry whitepapers', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "case study"', title: 'Case Studies', p: 'Find case study analyses', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "analysis"', title: 'Analysis Reports', p: 'Find analytical reports and assessments', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "summary"', title: 'Executive Summaries', p: 'Find executive summaries and overviews', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "research" filetype:pdf', title: 'Research PDFs', p: 'Find research papers in PDF format', type: 'document', s: 'high' },
      { t: '"{{target}}" "Q1" OR "Q2" OR "Q3" OR "Q4"', title: 'Quarterly Reports', p: 'Find quarterly business or research reports', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "annual" filetype:pdf', title: 'Annual Reports PDF', p: 'Find annual reports in PDF format', type: 'document', s: 'high' },
      { t: '"{{target}}" "market" "report"', title: 'Market Reports', p: 'Find market analysis and industry reports', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "audit" OR "assessment"', title: 'Audits & Assessments', p: 'Find audit and assessment reports', type: 'exact', s: 'medium' },
      { t: '"{{target}}" "postmortem" OR "incident report"', title: 'Postmortems', p: 'Find incident postmortem reports', type: 'exact', s: 'high' }
    ]
  }
};

const FILLER_WORDS = [
  'mujhe','dikhao','search karo','chahiye','ke baare me','karna','kaise','kya',
  'please','help','need','want','give me','tell me','show me','find me','looking for',
  'i want','i need','can you','could you','would you','please find','please show',
  'some','any','the','a','an','for','with','about','regarding','related to'
];

const INTENT_PATTERNS = [
  { intent: 'document', keywords: ['pdf','doc','document','file','report','whitepaper','spreadsheet','presentation','slide'], weight: 1.2, cat: 'documents' },
  { intent: 'learning', keywords: ['course','tutorial','learn','study','book','guide','training','certification','exam','syllabus','lesson'], weight: 1.0, cat: 'documents' },
  { intent: 'company', keywords: ['company','startup','enterprise','business','corporate','firm','vendor','ceo','founder','revenue','funding'], weight: 1.0, cat: 'company_research' },
  { intent: 'code', keywords: ['github','gitlab','repository','repo','source code','code','api','sdk','library','framework','npm','pip'], weight: 1.2, cat: 'code_research' },
  { intent: 'news', keywords: ['news','latest','update','announcement','press release','coverage','headline','article','current events'], weight: 1.0, cat: 'news_mentions' },
  { intent: 'forum', keywords: ['forum','discussion','thread','reddit','stackoverflow','community','review','opinion','advice','help'], weight: 0.9, cat: 'forums_discussions' },
  { intent: 'profile', keywords: ['profile','linkedin','twitter','portfolio','resume','cv','bio','social','person','people','author'], weight: 1.0, cat: 'public_profiles' },
  { intent: 'directory', keywords: ['directory','index','listing','files','downloads','backup','public','shared','archive','storage'], weight: 0.7, cat: 'public_directories' },
  { intent: 'techdocs', keywords: ['documentation','docs','manual','reference','configuration','api','guide','technical','spec'], weight: 1.0, cat: 'technical_docs' },
  { intent: 'reports', keywords: ['report','whitepaper','case study','analysis','summary','audit','assessment','research'], weight: 1.0, cat: 'reports' }
];

// Expose static data to the UI script without using localStorage or a backend.
window.ENGINES = ENGINES;
window.OPERATORS = OPERATORS;
window.SAMPLE_TARGETS = SAMPLE_TARGETS;
window.MODE_DEFINITIONS = MODE_DEFINITIONS;
window.MODE_TO_CATEGORY = MODE_TO_CATEGORY;
window.CATEGORIES = CATEGORIES;
window.FILLER_WORDS = FILLER_WORDS;
window.INTENT_PATTERNS = INTENT_PATTERNS;
