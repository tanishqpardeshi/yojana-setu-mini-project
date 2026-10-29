import { JanpadBlock, DocumentInfo } from '../types';

export interface WardInfo {
  number: number;
  name: string;
  zone: number;
  areaDescription: string;
  zonalOffice: string;
  populationEstimate: number;
  povertyIndex: 'Low' | 'Medium' | 'High';
}

export interface JanpadBlockInfo {
  name: JanpadBlock;
  panchayatCount: number;
  headquarters: string;
  popularPanchayats: string[];
  primaryEconomy: string;
  helpline: string;
}

// All 85 Indore Municipal Corporation (IMC) Wards (Authentic Localities & Zonal Distribution)
export const IMC_WARDS: WardInfo[] = [
  { number: 1, name: 'Sirpur / Chandan Nagar', zone: 1, areaDescription: 'Sirpur Lake & Chandan Nagar residential belt', zonalOffice: 'Zone 1 Karyalaya, Dhar Road', populationEstimate: 42000, povertyIndex: 'High' },
  { number: 2, name: 'Kila Maidan / Scheme 51', zone: 1, areaDescription: 'Kila Maidan historic fort area & Scheme 51', zonalOffice: 'Zone 1 Karyalaya, Dhar Road', populationEstimate: 38000, povertyIndex: 'Medium' },
  { number: 3, name: 'Kushwah Nagar', zone: 2, areaDescription: 'Kushwah Nagar & Banganga Main Road', zonalOffice: 'Zone 2 Karyalaya, Banganga', populationEstimate: 41000, povertyIndex: 'High' },
  { number: 4, name: 'Bhagirath Pura', zone: 2, areaDescription: 'Bhagirath Pura industrial & artisan colony', zonalOffice: 'Zone 2 Karyalaya, Banganga', populationEstimate: 46000, povertyIndex: 'High' },
  { number: 5, name: 'Govind Nagar', zone: 2, areaDescription: 'Govind Nagar & Sangam Nagar cluster', zonalOffice: 'Zone 2 Karyalaya, Banganga', populationEstimate: 36000, povertyIndex: 'Medium' },
  { number: 6, name: 'Subhash Nagar', zone: 2, areaDescription: 'Subhash Nagar & Pardeshipura link sector', zonalOffice: 'Zone 2 Karyalaya, Banganga', populationEstimate: 39000, povertyIndex: 'Medium' },
  { number: 7, name: 'Nanda Nagar West', zone: 3, areaDescription: 'Nanda Nagar ITI Colony & Labour Chowk', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 44000, povertyIndex: 'Medium' },
  { number: 8, name: 'Nanda Nagar East', zone: 3, areaDescription: 'Nanda Nagar Bajrang Nagar & Ganeshpuri', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 42000, povertyIndex: 'Medium' },
  { number: 9, name: 'Pardeshipura Mill Area', zone: 3, areaDescription: 'Historic Mill Workers Colony & Bhandari Mill', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 51000, povertyIndex: 'High' },
  { number: 10, name: 'Kulkarni Nagar', zone: 3, areaDescription: 'Kulkarni Bhatta, Sarvhara Nagar & Sarvodaya Nagar', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 47000, povertyIndex: 'High' },
  { number: 11, name: 'Sukhliya', zone: 4, areaDescription: 'Sukhliya Main Market & Nyay Nagar residential sector', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 43000, povertyIndex: 'Low' },
  { number: 12, name: 'Bhamori / Scheme 54', zone: 4, areaDescription: 'Bhamori Commercial Plaza & Meghdoot Garden', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 45000, povertyIndex: 'Low' },
  { number: 13, name: 'Rasoma / Scheme 78', zone: 4, areaDescription: 'Scheme 78 Aranya Nagar & Prestige Institute sector', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 40000, povertyIndex: 'Low' },
  { number: 14, name: 'Niranjanpur / Dewas Naka', zone: 4, areaDescription: 'Dewas Naka transport hub & warehousing belt', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 49000, povertyIndex: 'Medium' },
  { number: 15, name: 'Khajrana North', zone: 5, areaDescription: 'Khajrana Ganesh Temple, Kazi Ki Baag & Badi Dargah', zonalOffice: 'Zone 5 Karyalaya, Khajrana', populationEstimate: 58000, povertyIndex: 'High' },
  { number: 16, name: 'Khajrana South', zone: 5, areaDescription: 'Khajrana Ring Road, Goya Colony & Islam Nagar', zonalOffice: 'Zone 5 Karyalaya, Khajrana', populationEstimate: 55000, povertyIndex: 'High' },
  { number: 17, name: 'Bhavarkua / Pipliyahana', zone: 6, areaDescription: 'Pipliyahana Lake, Ring Road & World Cup Square', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 48000, povertyIndex: 'Low' },
  { number: 18, name: 'Bengali Colony / Scheme 94', zone: 6, areaDescription: 'Bengali Square, Goyal Nagar & Telephone Nagar', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 43000, povertyIndex: 'Low' },
  { number: 19, name: 'Tilak Nagar', zone: 6, areaDescription: 'Tilak Nagar, Saket Colony & Savindnagar', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 39000, povertyIndex: 'Low' },
  { number: 20, name: 'Musakhedi North', zone: 7, areaDescription: 'Musakhedi Main Square, Azad Nagar Link & Santosh Nagar', zonalOffice: 'Zone 7 Karyalaya, Azad Nagar', populationEstimate: 52000, povertyIndex: 'High' },
  { number: 21, name: 'Musakhedi South', zone: 7, areaDescription: 'Nehrunagar Basti & Musakhedi Industrial Ring Road', zonalOffice: 'Zone 7 Karyalaya, Azad Nagar', populationEstimate: 50000, povertyIndex: 'High' },
  { number: 22, name: 'Malharganj', zone: 8, areaDescription: 'Historic Cloth & Grains Wholesale Market', zonalOffice: 'Zone 8 Karyalaya, Malharganj', populationEstimate: 37000, povertyIndex: 'Medium' },
  { number: 23, name: 'Jinsi / Jinwal', zone: 8, areaDescription: 'Jinsi Hat Maidan, Subhash Chowk & Imli Bazar', zonalOffice: 'Zone 8 Karyalaya, Malharganj', populationEstimate: 35000, povertyIndex: 'Medium' },
  { number: 24, name: 'Bada Ganpati', zone: 8, areaDescription: 'Bada Ganpati Temple, Ramchandra Nagar & Jinsi Link', zonalOffice: 'Zone 8 Karyalaya, Malharganj', populationEstimate: 41000, povertyIndex: 'Medium' },
  { number: 25, name: 'Aerodrome Road / Kalani Nagar', zone: 8, areaDescription: 'Kalani Nagar, Airport Road & Sheetal Nagar', zonalOffice: 'Zone 8 Karyalaya, Malharganj', populationEstimate: 44000, povertyIndex: 'Low' },
  { number: 26, name: 'Bijasan / Gandhi Nagar', zone: 8, areaDescription: 'Bijasan Tekri & Gandhi Nagar residential colony', zonalOffice: 'Zone 8 Karyalaya, Malharganj', populationEstimate: 46000, povertyIndex: 'Medium' },
  { number: 27, name: 'Pagnis Paga / Chhatribagh', zone: 9, areaDescription: 'Holkar Cenotaphs Chhatris & Raoji Bazar link', zonalOffice: 'Zone 9 Karyalaya, Chhatribagh', populationEstimate: 36000, povertyIndex: 'Medium' },
  { number: 28, name: 'South Toda / North Toda', zone: 9, areaDescription: 'Kanh Riverfront, Toda Bastis & Kabutar Khana', zonalOffice: 'Zone 9 Karyalaya, Chhatribagh', populationEstimate: 42000, povertyIndex: 'High' },
  { number: 29, name: 'Moti Tabela / Collectorate', zone: 9, areaDescription: 'District Collector Office, Harsiddhi & Collectorate Square', zonalOffice: 'Zone 9 Karyalaya, Chhatribagh', populationEstimate: 34000, povertyIndex: 'Low' },
  { number: 30, name: 'Jawahar Marg / Ranipura', zone: 9, areaDescription: 'Ranipura Wholesale Toys, Fireworks & Fancy Market', zonalOffice: 'Zone 9 Karyalaya, Chhatribagh', populationEstimate: 33000, povertyIndex: 'Medium' },
  { number: 31, name: 'Siyaganj / Railway Station', zone: 10, areaDescription: 'Siyaganj Kirana Mandi & Indore Central Railway Station', zonalOffice: 'Zone 10 Karyalaya, Chhoti Gwaltoli', populationEstimate: 39000, povertyIndex: 'Medium' },
  { number: 32, name: 'Chhoti Gwaltoli', zone: 10, areaDescription: 'Sarwate Bus Stand, Dawa Bazar & Patel Bridge', zonalOffice: 'Zone 10 Karyalaya, Chhoti Gwaltoli', populationEstimate: 38000, povertyIndex: 'Medium' },
  { number: 33, name: 'Banganga / Sanwer Road', zone: 2, areaDescription: 'Banganga Railway Crossing & Sanwer Road Sector A', zonalOffice: 'Zone 2 Karyalaya, Banganga', populationEstimate: 52000, povertyIndex: 'High' },
  { number: 34, name: 'Marimata / Polo Ground', zone: 1, areaDescription: 'Polo Ground Industrial Area & Marimata Square', zonalOffice: 'Zone 1 Karyalaya, Dhar Road', populationEstimate: 40000, povertyIndex: 'Medium' },
  { number: 35, name: 'Snehalataganj / Vallabh Nagar', zone: 10, areaDescription: 'Snehalataganj & SGSITS Engineering College campus', zonalOffice: 'Zone 10 Karyalaya, Chhoti Gwaltoli', populationEstimate: 32000, povertyIndex: 'Low' },
  { number: 36, name: 'Tukoganj South / New Palasia', zone: 11, areaDescription: 'Race Course Road, High Court Indore & New Palasia', zonalOffice: 'Zone 11 Karyalaya, Palasia', populationEstimate: 31000, povertyIndex: 'Low' },
  { number: 37, name: 'Manorama Ganj', zone: 11, areaDescription: 'Manorama Ganj, Gita Bhawan Temple & A.B. Road link', zonalOffice: 'Zone 11 Karyalaya, Palasia', populationEstimate: 33000, povertyIndex: 'Low' },
  { number: 38, name: 'Chitawad / Navlakha', zone: 12, areaDescription: 'Navlakha Bus Stand & Chitawad Basti', zonalOffice: 'Zone 12 Karyalaya, Bhavarkua', populationEstimate: 47000, povertyIndex: 'High' },
  { number: 39, name: 'Bhavarkua University Campus', zone: 12, areaDescription: 'DAVV Takshashila Campus, Holkar Science & GACC', zonalOffice: 'Zone 12 Karyalaya, Bhavarkua', populationEstimate: 45000, povertyIndex: 'Low' },
  { number: 40, name: 'Vishnupuri / Transport Nagar', zone: 12, areaDescription: 'Transport Nagar, Vishnupuri & AB Road Corridor', zonalOffice: 'Zone 12 Karyalaya, Bhavarkua', populationEstimate: 42000, povertyIndex: 'Medium' },
  { number: 41, name: 'Chhatrapati Shivaji Nagar / Palda', zone: 7, areaDescription: 'Palda Industrial Agro Complex & Chhatrapati Nagar', zonalOffice: 'Zone 7 Karyalaya, Azad Nagar', populationEstimate: 51000, povertyIndex: 'High' },
  { number: 42, name: 'Chandan Nagar West', zone: 1, areaDescription: 'Chandan Nagar Sector B, Dhar Naka & Geeta Nagar', zonalOffice: 'Zone 1 Karyalaya, Dhar Road', populationEstimate: 54000, povertyIndex: 'High' },
  { number: 43, name: 'Malviya Nagar', zone: 4, areaDescription: 'Malviya Nagar, Scheme 54 South & Radisson Square link', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 39000, povertyIndex: 'Low' },
  { number: 44, name: 'Dravid Nagar / Ranjeet Marg', zone: 13, areaDescription: 'Dravid Nagar, Ranjeet Hanuman & Sudama Nagar border', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 41000, povertyIndex: 'Medium' },
  { number: 45, name: 'Chhappan Dukan / Old Palasia', zone: 11, areaDescription: '56 Dukan Street Food Clean Street & Old Palasia', zonalOffice: 'Zone 11 Karyalaya, Palasia', populationEstimate: 34000, povertyIndex: 'Low' },
  { number: 46, name: 'Geeta Nagar / Juni Indore', zone: 16, areaDescription: 'Juni Indore Old Settlement & Sindhi Colony Market', zonalOffice: 'Zone 16 Karyalaya, Juni Indore', populationEstimate: 38000, povertyIndex: 'Medium' },
  { number: 47, name: 'Raoji Bazar / Khatipura', zone: 16, areaDescription: 'Raoji Bazar Thana, Khatipura & Kanh River embankment', zonalOffice: 'Zone 16 Karyalaya, Juni Indore', populationEstimate: 39000, povertyIndex: 'High' },
  { number: 48, name: 'Daulatganj / Mukadamganj', zone: 16, areaDescription: 'Daulatganj Wholesale Kirana & Mukadamganj', zonalOffice: 'Zone 16 Karyalaya, Juni Indore', populationEstimate: 36000, povertyIndex: 'Medium' },
  { number: 49, name: 'Murai Mohalla / Chhavani', zone: 17, areaDescription: 'Chhavani Grains Mandi, Murai Mohalla & Sanyogitaganj', zonalOffice: 'Zone 17 Karyalaya, Chhavani', populationEstimate: 43000, povertyIndex: 'Medium' },
  { number: 50, name: 'Sudama Nagar North', zone: 13, areaDescription: 'Sudama Nagar residential sectors E, F & G', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 46000, povertyIndex: 'Medium' },
  { number: 51, name: 'Sudama Nagar South', zone: 13, areaDescription: 'Usha Nagar, Footi Kothi & Suryadev Nagar link', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 44000, povertyIndex: 'Medium' },
  { number: 52, name: 'Gumasta Nagar / Scheme 71', zone: 13, areaDescription: 'Gumasta Nagar & Scheme 71 commercial complex', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 42000, povertyIndex: 'Low' },
  { number: 53, name: 'Dwarkapuri / Prajapat Nagar', zone: 13, areaDescription: 'Dwarkapuri 60 Feet Road, Prajapat Nagar pottery clusters', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 53000, povertyIndex: 'High' },
  { number: 54, name: 'Lokmanya Nagar', zone: 13, areaDescription: 'Lokmanya Nagar, Kesharbagh Road & Railway Crossing', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 38000, povertyIndex: 'Low' },
  { number: 55, name: 'Annapurna / Narendra Tiwari Marg', zone: 13, areaDescription: 'Annapurna Temple, Dussehra Maidan & Usha Raje Stadium', zonalOffice: 'Zone 13 Karyalaya, Annapurna', populationEstimate: 41000, povertyIndex: 'Low' },
  { number: 56, name: 'Manikbagh / Silicon Corridor', zone: 16, areaDescription: 'Manikbagh Palace heritage zone & Choithram Square link', zonalOffice: 'Zone 16 Karyalaya, Juni Indore', populationEstimate: 37000, povertyIndex: 'Medium' },
  { number: 57, name: 'Palsikar Colony / Sindhi Colony', zone: 16, areaDescription: 'Palsikar Colony & Old Sindhi Colony market', zonalOffice: 'Zone 16 Karyalaya, Juni Indore', populationEstimate: 36000, povertyIndex: 'Low' },
  { number: 58, name: 'Khajrana Village / Star Chouraha', zone: 5, areaDescription: 'Khajrana Gram, Star Chouraha & MR-9 corridor', zonalOffice: 'Zone 5 Karyalaya, Khajrana', populationEstimate: 47000, povertyIndex: 'Medium' },
  { number: 59, name: 'Mayur Nagar / Musakhedi Link', zone: 18, areaDescription: 'Mayur Nagar, Ring Road bypass & Ashish Nagar', zonalOffice: 'Zone 18 Karyalaya, Kanadia Road', populationEstimate: 43000, povertyIndex: 'Medium' },
  { number: 60, name: 'Rajwada / Sarafa', zone: 9, areaDescription: 'Historical Rajwada Palace, Sarafa Night Food Market & Bartan Bazar', zonalOffice: 'Zone 9 Karyalaya, Chhatribagh', populationEstimate: 37000, povertyIndex: 'Medium' },
  { number: 61, name: 'Jail Road / Kothari Market', zone: 10, areaDescription: 'Jail Road Electronics Market & Kothari Market Plaza', zonalOffice: 'Zone 10 Karyalaya, Chhoti Gwaltoli', populationEstimate: 35000, povertyIndex: 'Medium' },
  { number: 62, name: 'Nehru Stadium / Residency Area', zone: 11, areaDescription: 'Nehru Stadium, Indore Residency Club & Daly College zone', zonalOffice: 'Zone 11 Karyalaya, Palasia', populationEstimate: 33000, povertyIndex: 'Low' },
  { number: 63, name: 'Piplya Rao / Bilawali Lake', zone: 12, areaDescription: 'Bilawali Lake catchment, Piplya Rao & Regional Park', zonalOffice: 'Zone 12 Karyalaya, Bhavarkua', populationEstimate: 44000, povertyIndex: 'Medium' },
  { number: 64, name: 'Ashoka Nagar / Bhanwarkuan South', zone: 12, areaDescription: 'Ashoka Nagar, Bholaram Ustad Marg coaching hub', zonalOffice: 'Zone 12 Karyalaya, Bhavarkua', populationEstimate: 48000, povertyIndex: 'Medium' },
  { number: 65, name: 'Rajendra Nagar / Silicon City', zone: 14, areaDescription: 'Cat Road, RRCAT Research Campus & Silicon City Colony', zonalOffice: 'Zone 14 Karyalaya, Rajendra Nagar', populationEstimate: 51000, povertyIndex: 'Medium' },
  { number: 66, name: 'CAT / Sukh Niwas Lake', zone: 14, areaDescription: 'Sukh Niwas Palace, CAT Gate 1 & Hawa Bangla', zonalOffice: 'Zone 14 Karyalaya, Rajendra Nagar', populationEstimate: 42000, povertyIndex: 'Low' },
  { number: 67, name: 'Tejaji Nagar / Silver Springs', zone: 15, areaDescription: 'Silver Springs Township, Tejaji Nagar Square & Bypass', zonalOffice: 'Zone 15 Karyalaya, Limbodi', populationEstimate: 47000, povertyIndex: 'Low' },
  { number: 68, name: 'Limbodi / Khandwa Road', zone: 15, areaDescription: 'Limbodi Gram, Khandwa Road IT Park & Swami Vivekanand Nagar', zonalOffice: 'Zone 15 Karyalaya, Limbodi', populationEstimate: 49000, povertyIndex: 'Medium' },
  { number: 69, name: 'Ralamandal / Mirjapur', zone: 15, areaDescription: 'Ralamandal Wildlife Sanctuary foothills & Mirjapur', zonalOffice: 'Zone 15 Karyalaya, Limbodi', populationEstimate: 38000, povertyIndex: 'High' },
  { number: 70, name: 'Tejaji Nagar / Morod', zone: 15, areaDescription: 'Morod, Phoenix Citadel link & Khandwa Road bypass', zonalOffice: 'Zone 15 Karyalaya, Limbodi', populationEstimate: 46000, povertyIndex: 'Medium' },
  { number: 71, name: 'Anoop Nagar / MIG Colony', zone: 4, areaDescription: 'Anoop Nagar, CHL Hospital sector & MIG Colony Phase 1', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 41000, povertyIndex: 'Low' },
  { number: 72, name: 'Vijay Nagar / Scheme 54', zone: 4, areaDescription: 'Vijay Nagar Square, C21 Mall & Bombay Hospital belt', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 49000, povertyIndex: 'Low' },
  { number: 73, name: 'Bapat Square / Scheme 114', zone: 4, areaDescription: 'Bapat Square, Scheme 114 Part 1 & Part 2', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 44000, povertyIndex: 'Low' },
  { number: 74, name: 'MR-10 Junction / Chandra Shekhar Azad', zone: 4, areaDescription: 'ISBT MR-10, Kumedi & Chandra Shekhar Azad Nagar', zonalOffice: 'Zone 4 Karyalaya, Bhamori', populationEstimate: 46000, povertyIndex: 'Medium' },
  { number: 75, name: 'LIG Colony / Scheme 74', zone: 3, areaDescription: 'LIG Square, MIG Thana & Patnipura Main Road', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 43000, povertyIndex: 'Medium' },
  { number: 76, name: 'Patnipura / Nehru Nagar', zone: 3, areaDescription: 'Patnipura Square, Nehru Nagar & Janata Quarter', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 45000, povertyIndex: 'High' },
  { number: 77, name: 'Sanjay Nagar / Pardeshipura East', zone: 3, areaDescription: 'Sanjay Nagar, Rustam Ka Bagicha & Malwa Mill link', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 47000, povertyIndex: 'High' },
  { number: 78, name: 'Kalyan Mill / Rajkumar Bridge', zone: 3, areaDescription: 'Kalyan Mill ground, Shrimant Madhavrao Scindia Marg', zonalOffice: 'Zone 3 Karyalaya, Pardeshipura', populationEstimate: 48000, povertyIndex: 'High' },
  { number: 79, name: 'Radhaswami Satsang / Pipliyahana Lake', zone: 6, areaDescription: 'Radhaswami Satsang Vyas, World Cup Square & Goyal Vihar', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 41000, povertyIndex: 'Low' },
  { number: 80, name: 'Bicholi Hapsi / Pragati Vihar', zone: 6, areaDescription: 'Bicholi Hapsi, Kanadia Road bypass & Pragati Vihar', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 39000, povertyIndex: 'Medium' },
  { number: 81, name: 'Sampat Farms / Bicholi Mardana', zone: 6, areaDescription: 'Sampat Farms, Bicholi Mardana & Agrawal Public School sector', zonalOffice: 'Zone 6 Karyalaya, Bengali Square', populationEstimate: 43000, povertyIndex: 'Low' },
  { number: 82, name: 'Nipania / Mahalaxmi Nagar', zone: 5, areaDescription: 'Mahalaxmi Nagar, Nipania Main Road & Bombay Hospital rear', zonalOffice: 'Zone 5 Karyalaya, Khajrana', populationEstimate: 51000, povertyIndex: 'Low' },
  { number: 83, name: 'Lasudia Mori / Dewas Bypass', zone: 19, areaDescription: 'Lasudia Mori Logistics Park, Scheme 136 & Dewas Bypass', zonalOffice: 'Zone 19 Karyalaya, Lasudia', populationEstimate: 53000, povertyIndex: 'Medium' },
  { number: 84, name: 'Manglia / AB Road Industrial Corridor', zone: 19, areaDescription: 'Manglia Dry Port, LPG Plant & AB Road North Industrial', zonalOffice: 'Zone 19 Karyalaya, Lasudia', populationEstimate: 46000, povertyIndex: 'High' },
  { number: 85, name: 'Rau Border / Scheme 140', zone: 14, areaDescription: 'Rau Circle, Emerald Heights, Pipliya Kumar & Scheme 140', zonalOffice: 'Zone 14 Karyalaya, Rajendra Nagar', populationEstimate: 53000, povertyIndex: 'Medium' },
];

// 4 Rural Janpad Panchayats of Indore District
export const JANPAD_BLOCKS: JanpadBlockInfo[] = [
  {
    name: 'Indore',
    panchayatCount: 64,
    headquarters: 'Indore Janpad Office, Collectorate Annexe',
    popularPanchayats: ['Kanadia', 'Bicholi Mardana', 'Sinhasa', 'Dudhia', 'Machal', 'Hatod', 'Ralamandal', 'Rangwasa'],
    primaryEconomy: 'Peri-urban farming, dairy cooperatives, logistics warehousing',
    helpline: '0731-2432810',
  },
  {
    name: 'Mhow',
    panchayatCount: 78,
    headquarters: 'Janpad Panchayat Dr. Ambedkar Nagar (Mhow)',
    popularPanchayats: ['Kodariya', 'Hasalpur', 'Simrol', 'Gujarkheda', 'Jamli', 'Mhowgaon', 'Bargonda', 'Bhagora'],
    primaryEconomy: 'Tribal forestry, bamboo craft, millets, organic vegetables, dairy',
    helpline: '07324-272140',
  },
  {
    name: 'Sanwer',
    panchayatCount: 92,
    headquarters: 'Janpad Panchayat Sanwer, Ujjain Road',
    popularPanchayats: ['Chandrawatiganj', 'Ajnod', 'Kshipra', 'Budhi Barlai', 'Dhamnay', 'Panod', 'Murkheda'],
    primaryEconomy: 'Soybean, wheat, garlic & onion cash crops, poultry, horticulture',
    helpline: '0731-283221',
  },
  {
    name: 'Depalpur',
    panchayatCount: 86,
    headquarters: 'Janpad Panchayat Depalpur, Betma Road',
    popularPanchayats: ['Betma', 'Gautampura', 'Jalod', 'Banadia', 'Chander', 'Rundiji', 'Ataheda'],
    primaryEconomy: 'Malwi Desi cow dairying, Chambal river basin wheat, pulses, organic farming',
    helpline: '07322-220033',
  },
];

// Document Master List for Verification & DigiLocker
export const STANDARD_DOCUMENTS: DocumentInfo[] = [
  { id: 'aadhaar', name: 'Aadhaar Card', nameHindi: 'आधार कार्ड', issuingAuthority: 'UIDAI', isDigiLockerAvailable: true, category: 'identity' },
  { id: 'samagra_member', name: 'Samagra Member ID (9-Digit)', nameHindi: 'समग्र सदस्य आईडी', issuingAuthority: 'MP SPR Portal', isDigiLockerAvailable: true, category: 'identity' },
  { id: 'samagra_family', name: 'Samagra Family ID (8-Digit)', nameHindi: 'समग्र परिवार आईडी', issuingAuthority: 'MP SPR Portal', isDigiLockerAvailable: true, category: 'identity' },
  { id: 'mp_domicile', name: 'MP Domicile Certificate', nameHindi: 'मूल निवासी प्रमाण पत्र', issuingAuthority: 'MP e-District / SDM Indore', isDigiLockerAvailable: true, category: 'address' },
  { id: 'income_cert', name: 'Digital Income Certificate', nameHindi: 'डिजिटल आय प्रमाण पत्र', issuingAuthority: 'MP Lok Seva Kendra (RSK)', isDigiLockerAvailable: true, category: 'income' },
  { id: 'khasra_b1', name: 'Khasra / Khatauni B-1', nameHindi: 'खसरा खतौनी / बी-1 (भू-अभिलेख)', issuingAuthority: 'MP Bhulekh Revenue Dept', isDigiLockerAvailable: true, category: 'land' },
  { id: 'caste_cert', name: 'Digital Caste Certificate (SC/ST/OBC)', nameHindi: 'डिजिटल जाति प्रमाण पत्र', issuingAuthority: 'Tribal Welfare / Revenue Dept MP', isDigiLockerAvailable: true, category: 'caste' },
  { id: 'bank_dbt', name: 'Bank Passbook (Aadhaar & DBT NPCI Linked)', nameHindi: 'बैंक पासबुक (डीबीटी एक्टिव)', issuingAuthority: 'Scheduled Commercial Bank', isDigiLockerAvailable: true, category: 'banking' },
  { id: 'udid_card', name: 'UDID Disability Certificate Card', nameHindi: 'दिव्यांग यूडीआईडी कार्ड', issuingAuthority: 'Ministry of Social Justice / MYH Indore', isDigiLockerAvailable: true, category: 'identity' },
  { id: 'vendor_id', name: 'IMC Urban Street Vendor ID Card', nameHindi: 'नगर निगम पथ विक्रेता प्रमाण पत्र', issuingAuthority: 'IMC Town Vending Committee', isDigiLockerAvailable: false, category: 'identity' },
  { id: 'bpl_ration', name: 'BPL / Antyodaya Ration Card', nameHindi: 'बीपीएल / अन्त्योदय राशन कार्ड', issuingAuthority: 'Food & Civil Supplies Dept MP', isDigiLockerAvailable: true, category: 'income' },
  { id: 'sambal_card', name: 'Sambal 2.0 Registered Card', nameHindi: 'संबल 2.0 श्रमिक कार्ड', issuingAuthority: 'Labor Department MP', isDigiLockerAvailable: true, category: 'identity' },
];

export const GOVERNANCE_LEVEL_NAMES = {
  international: { en: 'Level 1: International & Multilateral', hi: 'स्तर 1: अंतर्राष्ट्रीय व बहुपक्षीय', color: 'indigo' },
  national: { en: 'Level 2: National (Central Govt)', hi: 'स्तर 2: राष्ट्रीय (केंद्र सरकार)', color: 'blue' },
  state_mp: { en: 'Level 3: Madhya Pradesh State', hi: 'स्तर 3: मध्य प्रदेश राज्य शासन', color: 'emerald' },
  district_indore: { en: 'Level 4: Indore Collectorate', hi: 'स्तर 4: इंदौर कलेक्ट्रेट (जिला प्रशासन)', color: 'amber' },
  urban_imc: { en: 'Level 5: IMC Urban Wards (1-85)', hi: 'स्तर 5: इंदौर नगर निगम वार्ड 1-85', color: 'teal' },
  rural_janpad: { en: 'Level 6: Rural Janpad Panchayats', hi: 'स्तर 6: ग्रामीण जनपद पंचायतें', color: 'rose' },
};
