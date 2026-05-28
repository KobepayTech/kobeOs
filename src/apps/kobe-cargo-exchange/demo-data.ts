import type { Agent, PassengerListing, Deal, FlightRoute } from './types';

export const DEMO_AGENTS: Agent[] = [
  { id:'ag1', companyName:'Kobe Cargo TZ', contactName:'Hassan Mwangi', phone:'+255712000001', email:'hassan@kobecargo.co.tz', trustScore:94, trustTier:'elite', completedDeals:312, cancelledDeals:4, disputedDeals:1, buyRateMinUsd:150, buyRateMaxUsd:280, sellRatePerKgUsd:12, routes:['CAN-DAR','PVG-DAR','CAN-NBO'], isOnline:true },
  { id:'ag2', companyName:'FastAir Logistics', contactName:'Amina Osei', phone:'+255712000002', email:'amina@fastair.co.tz', trustScore:87, trustTier:'trusted', completedDeals:198, cancelledDeals:9, disputedDeals:3, buyRateMinUsd:120, buyRateMaxUsd:240, sellRatePerKgUsd:11, routes:['CAN-DAR','SZX-DAR'], isOnline:true },
  { id:'ag3', companyName:'SkyLink Africa', contactName:'David Kamau', phone:'+254712000003', email:'david@skylink.co.ke', trustScore:79, trustTier:'trusted', completedDeals:145, cancelledDeals:12, disputedDeals:5, buyRateMinUsd:100, buyRateMaxUsd:200, sellRatePerKgUsd:10, routes:['CAN-NBO','PVG-NBO'], isOnline:false },
  { id:'ag4', companyName:'PanAfrica Cargo', contactName:'Fatuma Diallo', phone:'+255712000004', email:'fatuma@panafricacargo.com', trustScore:65, trustTier:'verified', completedDeals:67, cancelledDeals:8, disputedDeals:2, buyRateMinUsd:90, buyRateMaxUsd:180, sellRatePerKgUsd:9.5, routes:['CAN-DAR','CAN-ADD'], isOnline:true },
];

export const DEMO_LISTINGS: PassengerListing[] = [
  {
    id:'pl1', passengerId:'p1', passengerName:'Zhang Wei', passengerPhone:'+8613800000001',
    trustScore:88, trustTier:'trusted',
    airline:'Ethiopian Airlines', flightNumber:'ET607', origin:'CAN', destination:'DAR',
    departureDate:'2026-06-10', arrivalDate:'2026-06-11', route:'CAN → ADD → DAR',
    totalAllowedKg:46, availableKg:30, reservedKg:16,
    askingPricePerKg:9, currency:'USD',
    negotiations:[], bargainCount:1, bargainLocked:false,
    ticketVerified:true, status:'negotiating', createdAt:'2026-06-01', expiresAt:'2026-06-09',
  },
  {
    id:'pl2', passengerId:'p2', passengerName:'Li Fang', passengerPhone:'+8613800000002',
    trustScore:72, trustTier:'verified',
    airline:'Emirates SkyCargo', flightNumber:'EK726', origin:'PVG', destination:'DAR',
    departureDate:'2026-06-12', arrivalDate:'2026-06-13', route:'PVG → DXB → DAR',
    totalAllowedKg:46, availableKg:40, reservedKg:6,
    askingPricePerKg:8.5, currency:'USD',
    negotiations:[], bargainCount:0, bargainLocked:false,
    ticketVerified:true, status:'available', createdAt:'2026-06-02', expiresAt:'2026-06-11',
  },
  {
    id:'pl3', passengerId:'p3', passengerName:'Wang Fei', passengerPhone:'+8613800000003',
    trustScore:91, trustTier:'elite',
    airline:'Qatar Airways', flightNumber:'QR836', origin:'CAN', destination:'DAR',
    departureDate:'2026-06-15', arrivalDate:'2026-06-16', route:'CAN → DOH → DAR',
    totalAllowedKg:46, availableKg:35, reservedKg:11,
    askingPricePerKg:10, currency:'USD',
    negotiations:[], bargainCount:3, bargainLocked:true,
    ticketVerified:true, status:'negotiating', createdAt:'2026-06-03', expiresAt:'2026-06-14',
  },
  {
    id:'pl4', passengerId:'p4', passengerName:'Chen Jing', passengerPhone:'+8613800000004',
    trustScore:55, trustTier:'new',
    airline:'Turkish Airlines', flightNumber:'TK78', origin:'CAN', destination:'NBO',
    departureDate:'2026-06-18', arrivalDate:'2026-06-19', route:'CAN → IST → NBO',
    totalAllowedKg:46, availableKg:46, reservedKg:0,
    askingPricePerKg:7.5, currency:'USD',
    negotiations:[], bargainCount:0, bargainLocked:false,
    ticketVerified:false, status:'available', createdAt:'2026-06-04', expiresAt:'2026-06-17',
  },
];

export const DEMO_DEALS: Deal[] = [
  {
    id:'d1', negotiationId:'n1', listingId:'pl0a', agentId:'ag1', agentName:'Kobe Cargo TZ',
    passengerId:'p0a', passengerName:'Liu Yang', flightNumber:'ET605', route:'CAN → ADD → DAR',
    departureDate:'2026-05-28',
    bulkBuyAmountUsd:210, kgPurchased:30, effectiveCostPerKgUsd:7.0,
    sellRatePerKgUsd:12, totalKgSold:28, totalRevenueUsd:336,
    grossProfitUsd:126, otherCostsUsd:25, netProfitUsd:101, marginPct:30.1,
    status:'completed', flightStatus:'arrived', createdAt:'2026-05-20', completedAt:'2026-05-29',
  },
  {
    id:'d2', negotiationId:'n2', listingId:'pl0b', agentId:'ag1', agentName:'Kobe Cargo TZ',
    passengerId:'p0b', passengerName:'Xu Ming', flightNumber:'EK724', route:'PVG → DXB → DAR',
    departureDate:'2026-06-02',
    bulkBuyAmountUsd:180, kgPurchased:25, effectiveCostPerKgUsd:7.2,
    sellRatePerKgUsd:12, totalKgSold:25, totalRevenueUsd:300,
    grossProfitUsd:120, otherCostsUsd:20, netProfitUsd:100, marginPct:33.3,
    status:'active', flightStatus:'arrived', createdAt:'2026-05-25',
  },
  {
    id:'d3', negotiationId:'n3', listingId:'pl0c', agentId:'ag2', agentName:'FastAir Logistics',
    passengerId:'p0c', passengerName:'Zhou Lan', flightNumber:'QR834', route:'CAN → DOH → DAR',
    departureDate:'2026-06-05',
    bulkBuyAmountUsd:240, kgPurchased:35, effectiveCostPerKgUsd:6.86,
    sellRatePerKgUsd:11, totalKgSold:30, totalRevenueUsd:330,
    grossProfitUsd:90, otherCostsUsd:30, netProfitUsd:60, marginPct:18.2,
    status:'active', flightStatus:'transit', createdAt:'2026-05-28',
  },
  {
    id:'d4', negotiationId:'n4', listingId:'pl0d', agentId:'ag1', agentName:'Kobe Cargo TZ',
    passengerId:'p0d', passengerName:'Ma Ling', flightNumber:'TK76', route:'CAN → IST → DAR',
    departureDate:'2026-06-08',
    bulkBuyAmountUsd:200, kgPurchased:28, effectiveCostPerKgUsd:7.14,
    sellRatePerKgUsd:12, totalKgSold:0, totalRevenueUsd:0,
    grossProfitUsd:-200, otherCostsUsd:15, netProfitUsd:-215, marginPct:0,
    status:'active', flightStatus:'scheduled', createdAt:'2026-06-01',
  },
];

export const DEMO_ROUTES: FlightRoute[] = [
  {
    id:'r1', airline:'Ethiopian Airlines', airlineCode:'ET',
    legs:[
      { from:{code:'CAN',name:'Guangzhou Baiyun',city:'Guangzhou',country:'China'}, to:{code:'ADD',name:'Addis Ababa Bole',city:'Addis Ababa',country:'Ethiopia'}, airline:'Ethiopian Airlines', flightNumber:'ET607', departureTime:'2026-06-10T23:30:00Z', arrivalTime:'2026-06-11T05:00:00Z', status:'scheduled' },
      { from:{code:'ADD',name:'Addis Ababa Bole',city:'Addis Ababa',country:'Ethiopia'}, to:{code:'DAR',name:'Julius Nyerere Intl',city:'Dar es Salaam',country:'Tanzania'}, airline:'Ethiopian Airlines', flightNumber:'ET843', departureTime:'2026-06-11T07:00:00Z', arrivalTime:'2026-06-11T10:30:00Z', status:'scheduled' },
    ],
    totalDurationHours:11, transitHubs:['ADD'], frequency:'Daily', avgRating:4.3,
  },
  {
    id:'r2', airline:'Emirates SkyCargo', airlineCode:'EK',
    legs:[
      { from:{code:'PVG',name:'Shanghai Pudong',city:'Shanghai',country:'China'}, to:{code:'DXB',name:'Dubai Intl',city:'Dubai',country:'UAE'}, airline:'Emirates', flightNumber:'EK726', departureTime:'2026-06-12T01:00:00Z', arrivalTime:'2026-06-12T05:30:00Z', status:'scheduled' },
      { from:{code:'DXB',name:'Dubai Intl',city:'Dubai',country:'UAE'}, to:{code:'DAR',name:'Julius Nyerere Intl',city:'Dar es Salaam',country:'Tanzania'}, airline:'Emirates', flightNumber:'EK727', departureTime:'2026-06-12T08:00:00Z', arrivalTime:'2026-06-12T13:00:00Z', status:'scheduled' },
    ],
    totalDurationHours:12, transitHubs:['DXB'], frequency:'Daily', avgRating:4.6,
  },
  {
    id:'r3', airline:'Qatar Airways', airlineCode:'QR',
    legs:[
      { from:{code:'CAN',name:'Guangzhou Baiyun',city:'Guangzhou',country:'China'}, to:{code:'DOH',name:'Hamad Intl',city:'Doha',country:'Qatar'}, airline:'Qatar Airways', flightNumber:'QR836', departureTime:'2026-06-15T02:00:00Z', arrivalTime:'2026-06-15T06:00:00Z', status:'scheduled' },
      { from:{code:'DOH',name:'Hamad Intl',city:'Doha',country:'Qatar'}, to:{code:'DAR',name:'Julius Nyerere Intl',city:'Dar es Salaam',country:'Tanzania'}, airline:'Qatar Airways', flightNumber:'QR543', departureTime:'2026-06-15T09:00:00Z', arrivalTime:'2026-06-15T14:00:00Z', status:'scheduled' },
    ],
    totalDurationHours:12, transitHubs:['DOH'], frequency:'Daily', avgRating:4.7,
  },
  {
    id:'r4', airline:'Turkish Airlines', airlineCode:'TK',
    legs:[
      { from:{code:'CAN',name:'Guangzhou Baiyun',city:'Guangzhou',country:'China'}, to:{code:'IST',name:'Istanbul Airport',city:'Istanbul',country:'Turkey'}, airline:'Turkish Airlines', flightNumber:'TK78', departureTime:'2026-06-18T03:00:00Z', arrivalTime:'2026-06-18T09:00:00Z', status:'scheduled' },
      { from:{code:'IST',name:'Istanbul Airport',city:'Istanbul',country:'Turkey'}, to:{code:'NBO',name:'Jomo Kenyatta Intl',city:'Nairobi',country:'Kenya'}, airline:'Turkish Airlines', flightNumber:'TK79', departureTime:'2026-06-18T12:00:00Z', arrivalTime:'2026-06-18T18:00:00Z', status:'scheduled' },
    ],
    totalDurationHours:15, transitHubs:['IST'], frequency:'Daily', avgRating:4.4,
  },
];

export const COMMON_ROUTES = [
  { origin:'CAN', originCity:'Guangzhou', dest:'DAR', destCity:'Dar es Salaam', airlines:['Ethiopian','Emirates','Qatar','Turkish'] },
  { origin:'PVG', originCity:'Shanghai', dest:'DAR', destCity:'Dar es Salaam', airlines:['Emirates','Ethiopian','Kenya Airways'] },
  { origin:'CAN', originCity:'Guangzhou', dest:'NBO', destCity:'Nairobi', airlines:['Turkish','Ethiopian','Kenya Airways'] },
  { origin:'SZX', originCity:'Shenzhen', dest:'DAR', destCity:'Dar es Salaam', airlines:['Ethiopian','Emirates'] },
  { origin:'CAN', originCity:'Guangzhou', dest:'ADD', destCity:'Addis Ababa', airlines:['Ethiopian'] },
  { origin:'PVG', originCity:'Shanghai', dest:'NBO', destCity:'Nairobi', airlines:['Kenya Airways','Emirates'] },
];
