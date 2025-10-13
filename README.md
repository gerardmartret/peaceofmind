# Peace of Mind - London District Safety Analysis

A comprehensive Next.js application for analyzing London district safety using real-time data from UK Police and Transport for London APIs.

## 🎯 Features

### ✅ Multi-District Comparison
- **Select multiple districts** at once (up to 24 districts)
- **Compare side-by-side** - All results displayed on the same page
- **Click to select** - Toggle districts on/off with a single click

### 📅 Custom Date Range
- **Start and End Date pickers** for TfL disruption analysis
- **Default**: Today + 30 days
- **Flexible**: Choose any future date range
- **Dynamic calculation** - Automatically calculates days between dates

### 🚨 Crime Statistics (UK Police API)
- **Real-time data** from official UK Police reports
- **Safety score** (0-100) calculated from crime data
- **Top 5 crime categories** with percentages
- **Investigation outcomes** breakdown
- **Monthly crime reports**

### 🚦 Traffic Disruptions (TfL API)
- **Live road disruption data** from Transport for London
- **Severity levels** (Moderate, Minimal)
- **Categories** (Works, Collisions, Events)
- **Active vs Upcoming** disruptions
- **Full details** with dates and descriptions

## 🏙️ Available Districts (24 Total)

### Central London
- Westminster
- City of London
- Soho
- Covent Garden
- Mayfair

### North London
- Camden
- Islington
- Hackney
- Shoreditch

### East London
- Tower Hamlets
- Canary Wharf
- Stratford
- Greenwich

### South London
- Southwark
- Lambeth
- Lewisham
- Brixton
- Clapham
- Wimbledon

### West London
- Kensington & Chelsea
- Hammersmith & Fulham
- Chelsea
- Notting Hill
- Wandsworth

## 🚀 How to Use

### 1. Select Districts
Click on district names to select/deselect them. Selected districts appear in blue. You can select as many as you want!

### 2. Set Date Range
- Choose **Start Date** (e.g., today)
- Choose **End Date** (e.g., 30 days from now)
- The date range is used for TfL disruption analysis

### 3. Analyze
Click **"Analyze X Districts"** button to fetch data for all selected districts

### 4. View Results
All selected districts are displayed on the same page with:
- Safety score at the top
- 4 key statistics
- Top 5 crime categories
- Top 3 road disruptions
- Side-by-side comparison

## 📊 What You Get for Each District

### Crime Data
- **Safety Score**: 0-100 (higher is safer)
  - 80-100: Very Safe 🟢
  - 60-79: Moderately Safe 🟡
  - 40-59: Caution Advised 🟠
  - 0-39: High Alert 🔴

- **Statistics**:
  - Total crime incidents
  - Crime breakdown by category
  - Investigation outcomes
  - Report month

### TfL Disruptions
- **Total disruptions** in date range
- **Active disruptions** right now
- **Moderate severity** count (high priority)
- **Top 3 disruptions** with:
  - Location
  - Severity level
  - Start and end dates
  - Category (Works, Collisions)

## 🔧 Technical Details

### APIs Used

#### 1. UK Police Open Data API
- **Endpoint**: `https://data.police.uk/api/crimes-street/all-crime`
- **Cost**: 100% FREE
- **API Key**: Not required
- **Rate Limit**: Unlimited
- **Coverage**: All UK (England, Wales, Northern Ireland)
- **Data**: Real crime reports with locations and outcomes

#### 2. Transport for London (TfL) Unified API
- **Endpoint**: `https://api.tfl.gov.uk/Road/all/Disruption`
- **Cost**: 100% FREE
- **API Key**: Not required (optional for higher limits)
- **Rate Limit**: Generous
- **Coverage**: All London roads
- **Data**: Real-time disruptions, planned works, collisions

### File Structure

```
/Users/gerardmartret/Downloads/peaceofmind/
├── app/
│   ├── page.tsx                    # Main UI with multi-select
│   ├── api/
│   │   ├── uk-crime/route.ts      # Crime data API
│   │   └── tfl-disruptions/route.ts # TfL disruptions API
├── lib/
│   ├── uk-police-api.ts           # UK Police API client
│   └── tfl-api.ts                 # TfL API client
├── .env.local                      # Environment variables (optional)
└── package.json
```

### Safety Score Calculation

```typescript
Score = 100 - Crime Penalty - Violence Penalty

Crime Penalty = min(50, (Total Crimes / 1000) × 1000)
Violence Penalty = min(30, (Violent Crimes / Total Crimes) × 30)

Final Score = max(0, min(100, Score))
```

## 💡 Usage Examples

### Compare 3 Districts
1. Select: Westminster, Soho, Wimbledon
2. Date range: Oct 13, 2025 → Nov 13, 2025
3. Click "Analyze 3 Districts"
4. View all 3 results stacked vertically

### Find Safest District
1. Select multiple districts (e.g., all 24)
2. Analyze them all
3. Compare safety scores
4. Look at crime categories
5. Check road disruptions

### Plan a Visit
1. Select your destination district
2. Set date range for your visit
3. Check crime statistics
4. Review planned road works
5. Make informed decisions

## 🎨 UI Features

- **Responsive Design**: Works on mobile, tablet, desktop
- **Dark Mode**: Full support for dark theme
- **Color-Coded**: Safety scores use intuitive colors
- **Interactive**: Click districts to toggle selection
- **Real-Time**: Data updates on each analysis
- **Beautiful**: Modern gradient design with shadows

## 📈 Console Output

When you analyze districts, detailed logs appear in the browser console:

```
============================================================
🚀 Fetching data for 2 district(s)
📅 Date Range: 2025-10-13 to 2025-11-13 (31 days)
📍 Districts: Westminster, Notting Hill
============================================================

🔍 Fetching data for Westminster...
✅ Westminster: 2981 crimes, 60 disruptions

🔍 Fetching data for Notting Hill...
✅ Notting Hill: 2947 crimes, 60 disruptions

============================================================
✅ Successfully retrieved data for all 2 district(s)!
============================================================
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

### First Use

1. Open `http://localhost:3000`
2. Westminster is pre-selected by default
3. Date range is automatically set (today + 30 days)
4. Click "Analyze 1 District" to see results
5. Select more districts and compare!

## 📝 Notes

- **Crime Data**: Updated monthly by UK Police
- **TfL Data**: Real-time updates for disruptions
- **Coverage**: 1-mile radius from district center
- **Free Forever**: Both APIs are 100% free with no limits
- **No API Keys**: No registration or keys needed

## 🔒 Privacy & Security

- **No personal data collected**
- **Public APIs only** - using official UK government data
- **Client-side processing** - data analysis happens in your browser
- **No tracking** - no analytics or third-party services

## 🎯 Use Cases

- **Moving to London**: Compare districts before choosing where to live
- **Visiting London**: Check safety of your destination
- **Planning routes**: Avoid areas with disruptions
- **Real estate**: Make informed property decisions
- **Urban research**: Study crime patterns across districts
- **Event planning**: Check for road disruptions during events

## 📚 API Documentation

- **UK Police API**: https://data.police.uk/docs/
- **TfL Unified API**: https://api.tfl.gov.uk/

## 🤝 Contributing

This is a demonstration project showing how to integrate real-time safety data from free government APIs.

## 📄 License

MIT License - Free to use and modify

---

**Built with Next.js 15, React 19, TypeScript, and Tailwind CSS**

**Data provided by UK Police and Transport for London**
