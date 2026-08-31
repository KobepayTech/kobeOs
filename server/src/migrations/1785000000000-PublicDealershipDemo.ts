import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicDealershipDemo1785000000000 implements MigrationInterface {
  name = 'PublicDealershipDemo1785000000000';

  public async up(q: QueryRunner): Promise<void> {
    const ownerId = '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e001';
    const businessId = '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e010';

    const businessRows = await q.query(
      `INSERT INTO "commerce_businesses"
        ("id","createdAt","updatedAt","businessId","publicSlug","ownerUserId","catalogOwnerId","name","merchantName","phone","email","tier","status","websiteEnabled","managementTokenHash","profile")
       VALUES
        ($1, now(), now(), 'BUS-DEMO-KIJANI', 'kijani-motors', $2, $2, 'Kijani Motors', 'Kijani Motors', '+255 712 345 678', 'sales@kijani.example', 'FULL', 'ACTIVE', true, '', $3::jsonb)
       ON CONFLICT ("publicSlug") DO UPDATE SET
         "updatedAt" = now(),
         "ownerUserId" = EXCLUDED."ownerUserId",
         "catalogOwnerId" = EXCLUDED."catalogOwnerId",
         "name" = EXCLUDED."name",
         "merchantName" = EXCLUDED."merchantName",
         "phone" = EXCLUDED."phone",
         "email" = EXCLUDED."email",
         "tier" = 'FULL',
         "status" = 'ACTIVE',
         "websiteEnabled" = true,
         "profile" = EXCLUDED."profile"
       RETURNING "id"`,
      [
        businessId,
        ownerId,
        JSON.stringify({
          businessType: 'DEALERSHIP',
          whatsapp: '+255712345678',
          showroomAddress: 'Nyerere Road, Dar es Salaam',
          address: 'Nyerere Road, Dar es Salaam',
          heroTitle: 'Find your next 4x4 at Kijani Motors',
          heroSubtitle: 'Demo dealership powered by KobeOS — compare live stock, reserve a vehicle, request financing, or book a showroom visit and test drive.',
          about: 'Kijani Motors is a KobeOS demonstration dealership. The vehicles below are demo records used to test the complete dealership, Jumla Cars and ERP CRM flow.',
          logoUrl: 'https://placehold.co/320x320/10261f/d5ff4f?text=KM',
          heroImageUrl: 'https://placehold.co/1600x900/071d18/d5ff4f?text=Kijani+Motors+Demo+Showroom',
          primaryColor: '#10261f',
          hours: [
            { day: 'Monday–Friday', open: '08:00', close: '18:00', label: 'Mon–Fri 08:00–18:00' },
            { day: 'Saturday', open: '09:00', close: '16:00', label: 'Sat 09:00–16:00' },
          ],
          socials: {},
          demo: true,
        }),
      ],
    );
    const resolvedBusinessId = (businessRows as Array<{ id: string }>)[0]?.id ?? businessId;

    const vehicles = [
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e101',
        stock: 'DEMO-PRADO-001',
        make: 'Toyota', model: 'Land Cruiser Prado', year: 2024, trim: 'TX-L',
        price: 185000000, mileage: 12000, transmission: 'Automatic', fuel: 'Diesel',
        color: 'Pearl White', interior: 'Black', engine: '2.8L Turbo Diesel', drive: '4WD', body: 'SUV',
        financing: true, negotiable: true, condition: 'USED',
        features: ['7 seats', '360 camera', 'Leather seats', 'Adaptive cruise control', 'Sunroof', 'Toyota Safety Sense'],
        image: 'https://placehold.co/1400x900/e9ecef/10261f?text=2024+Toyota+Land+Cruiser+Prado+TX-L',
        highlights: ['2024 Prado', '2.8L diesel', '4WD', '12,000 km', 'Financing available'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e102',
        stock: 'DEMO-PRADO-002',
        make: 'Toyota', model: 'Land Cruiser Prado', year: 2023, trim: 'TZ-G',
        price: 169000000, mileage: 22500, transmission: 'Automatic', fuel: 'Diesel',
        color: 'Black', interior: 'Beige', engine: '2.8L Turbo Diesel', drive: '4WD', body: 'SUV',
        financing: true, negotiable: false, condition: 'USED',
        features: ['7 seats', 'JBL audio', 'Crawl Control', 'Multi-Terrain Select', 'Leather seats'],
        image: 'https://placehold.co/1400x900/1f2937/ffffff?text=2023+Toyota+Land+Cruiser+Prado+TZ-G',
        highlights: ['2023 Prado', 'TZ-G', '4WD', '22,500 km', 'Premium specification'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e103',
        stock: 'DEMO-PRADO-003',
        make: 'Toyota', model: 'Land Cruiser Prado', year: 2022, trim: 'TX',
        price: 145000000, mileage: 41000, transmission: 'Automatic', fuel: 'Diesel',
        color: 'Silver', interior: 'Black', engine: '2.8L Turbo Diesel', drive: '4WD', body: 'SUV',
        financing: false, negotiable: true, condition: 'USED',
        features: ['7 seats', 'Reverse camera', 'Cruise control', 'Keyless start'],
        image: 'https://placehold.co/1400x900/d1d5db/111827?text=2022+Toyota+Land+Cruiser+Prado+TX',
        highlights: ['2022 Prado', 'TX', '4WD', '41,000 km', 'Negotiable'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e104',
        stock: 'DEMO-PRADO-004',
        make: 'Toyota', model: 'Land Cruiser Prado', year: 2021, trim: 'TX-L',
        price: 132000000, mileage: 56000, transmission: 'Automatic', fuel: 'Petrol',
        color: 'Dark Blue', interior: 'Black', engine: '2.7L Petrol', drive: '4WD', body: 'SUV',
        financing: true, negotiable: true, condition: 'USED',
        features: ['7 seats', 'Leather seats', 'Parking sensors', 'Dual-zone climate control'],
        image: 'https://placehold.co/1400x900/1e3a8a/ffffff?text=2021+Toyota+Land+Cruiser+Prado+TX-L',
        highlights: ['2021 Prado', '2.7L petrol', '4WD', '56,000 km', 'Financing available'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e105',
        stock: 'DEMO-LC300-001',
        make: 'Toyota', model: 'Land Cruiser 300', year: 2024, trim: 'ZX',
        price: 315000000, mileage: 8000, transmission: 'Automatic', fuel: 'Diesel',
        color: 'White', interior: 'Black', engine: '3.3L Twin-Turbo Diesel', drive: '4WD', body: 'SUV',
        financing: true, negotiable: false, condition: 'USED',
        features: ['7 seats', 'Head-up display', 'JBL audio', '360 camera', 'Ventilated seats'],
        image: 'https://placehold.co/1400x900/f8fafc/0f172a?text=2024+Toyota+Land+Cruiser+300+ZX',
        highlights: ['Land Cruiser 300', 'ZX', '3.3L twin-turbo diesel', '8,000 km', 'Premium 4WD'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e106',
        stock: 'DEMO-HARRIER-001',
        make: 'Toyota', model: 'Harrier', year: 2023, trim: 'Z Leather Package',
        price: 112000000, mileage: 18000, transmission: 'Automatic', fuel: 'Petrol',
        color: 'Black', interior: 'Brown', engine: '2.0L Petrol', drive: 'FWD', body: 'SUV',
        financing: true, negotiable: true, condition: 'USED',
        features: ['Panoramic roof', 'Leather seats', 'Digital mirror', 'Toyota Safety Sense'],
        image: 'https://placehold.co/1400x900/111827/f9fafb?text=2023+Toyota+Harrier+Z+Leather',
        highlights: ['2023 Harrier', 'Z Leather Package', '18,000 km', 'Panoramic roof'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e107',
        stock: 'DEMO-FORTUNER-001',
        make: 'Toyota', model: 'Fortuner', year: 2023, trim: 'Legender',
        price: 138000000, mileage: 26000, transmission: 'Automatic', fuel: 'Diesel',
        color: 'White', interior: 'Black', engine: '2.8L Turbo Diesel', drive: '4WD', body: 'SUV',
        financing: true, negotiable: true, condition: 'USED',
        features: ['7 seats', '4WD', 'Leather seats', 'Power tailgate', '360 camera'],
        image: 'https://placehold.co/1400x900/f3f4f6/111827?text=2023+Toyota+Fortuner+Legender',
        highlights: ['2023 Fortuner', 'Legender', '2.8L diesel', '4WD', '26,000 km'],
      },
      {
        id: '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e108',
        stock: 'DEMO-RAV4-001',
        make: 'Toyota', model: 'RAV4', year: 2022, trim: 'Adventure',
        price: 93000000, mileage: 34000, transmission: 'Automatic', fuel: 'Hybrid',
        color: 'Green', interior: 'Black', engine: '2.5L Hybrid', drive: 'AWD', body: 'SUV',
        financing: true, negotiable: true, condition: 'USED',
        features: ['AWD', 'Hybrid', 'Toyota Safety Sense', 'Wireless charging'],
        image: 'https://placehold.co/1400x900/14532d/ecfccb?text=2022+Toyota+RAV4+Adventure+Hybrid',
        highlights: ['2022 RAV4', 'Adventure', 'Hybrid AWD', '34,000 km'],
      },
    ] as const;

    for (const vehicle of vehicles) {
      await q.query(
        `INSERT INTO "commerce_vehicles"
          ("id","createdAt","updatedAt","businessId","catalogOwnerId","stockNumber","make","model","year","trim","price","currency","mileage","transmission","fuel","color","interiorColor","engine","driveType","bodyType","vin","registration","dutyStatus","source","financingAvailable","negotiable","features","location","condition","status","description","aiSalesCopy","metadata")
         VALUES
          ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, 'TZS', $10, $11, $12, $13, $14, $15, $16, $17, '', '', 'DUTY_PAID', 'IMPORTED', $18, $19, $20::jsonb, 'Dar es Salaam', $21, 'AVAILABLE', $22, $23, $24::jsonb)
         ON CONFLICT ("id") DO UPDATE SET
           "updatedAt" = now(),
           "businessId" = EXCLUDED."businessId",
           "catalogOwnerId" = EXCLUDED."catalogOwnerId",
           "stockNumber" = EXCLUDED."stockNumber",
           "make" = EXCLUDED."make",
           "model" = EXCLUDED."model",
           "year" = EXCLUDED."year",
           "trim" = EXCLUDED."trim",
           "price" = EXCLUDED."price",
           "mileage" = EXCLUDED."mileage",
           "transmission" = EXCLUDED."transmission",
           "fuel" = EXCLUDED."fuel",
           "color" = EXCLUDED."color",
           "interiorColor" = EXCLUDED."interiorColor",
           "engine" = EXCLUDED."engine",
           "driveType" = EXCLUDED."driveType",
           "bodyType" = EXCLUDED."bodyType",
           "financingAvailable" = EXCLUDED."financingAvailable",
           "negotiable" = EXCLUDED."negotiable",
           "features" = EXCLUDED."features",
           "location" = EXCLUDED."location",
           "condition" = EXCLUDED."condition",
           "description" = EXCLUDED."description",
           "aiSalesCopy" = EXCLUDED."aiSalesCopy",
           "metadata" = EXCLUDED."metadata"`,
        [
          vehicle.id,
          resolvedBusinessId,
          ownerId,
          vehicle.stock,
          vehicle.make,
          vehicle.model,
          vehicle.year,
          vehicle.trim,
          vehicle.price,
          vehicle.mileage,
          vehicle.transmission,
          vehicle.fuel,
          vehicle.color,
          vehicle.interior,
          vehicle.engine,
          vehicle.drive,
          vehicle.body,
          vehicle.financing,
          vehicle.negotiable,
          JSON.stringify(vehicle.features),
          vehicle.condition,
          `Demo vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}. Use this listing to test the KobeOS dealership experience.`,
          `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} available in this KobeOS demo dealership. Compare specifications, reserve it, request financing, or schedule a visit.`,
          JSON.stringify({ demo: true, seededBy: '1785000000000-PublicDealershipDemo' }),
        ],
      );

      await q.query(
        `INSERT INTO "commerce_vehicle_media"
          ("id","createdAt","updatedAt","vehicleId","url","kind","sortOrder","publicToken","mimeType","contentBinary")
         VALUES (uuid_generate_v4(), now(), now(), $1, $2, 'IMAGE', 0, NULL, NULL, NULL)
         ON CONFLICT DO NOTHING`,
        [vehicle.id, vehicle.image],
      );

      await q.query(
        `INSERT INTO "commerce_vehicle_listing_metadata"
          ("id","createdAt","updatedAt","vehicleId","highlights","keywords","socialCaption","verticalVideoUrl","purchaseCost","dutyCost","clearingCost","transportCost","repairCost","advertisingCost")
         VALUES (uuid_generate_v4(), now(), now(), $1, $2::jsonb, $3::jsonb, $4, '', 0, 0, 0, 0, 0, 0)
         ON CONFLICT ("vehicleId") DO UPDATE SET
           "updatedAt" = now(),
           "highlights" = EXCLUDED."highlights",
           "keywords" = EXCLUDED."keywords",
           "socialCaption" = EXCLUDED."socialCaption"`,
        [
          vehicle.id,
          JSON.stringify(vehicle.highlights),
          JSON.stringify([vehicle.make, vehicle.model, String(vehicle.year), vehicle.trim, vehicle.body, vehicle.fuel]),
          `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} · ${vehicle.mileage.toLocaleString()} km · ${vehicle.engine} · ${vehicle.drive}. Demo listing at Kijani Motors.`,
        ],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const ids = [
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e101',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e102',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e103',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e104',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e105',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e106',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e107',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e108',
    ];
    await q.query(`DELETE FROM "commerce_vehicle_listing_metadata" WHERE "vehicleId" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_vehicle_media" WHERE "vehicleId" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_vehicle_appointments" WHERE "vehicleId" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_vehicle_reservations" WHERE "vehicleId" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_vehicle_buyer_requests" WHERE "vehicleId" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_vehicles" WHERE "id" = ANY($1::uuid[])`, [ids]);
    await q.query(`DELETE FROM "commerce_businesses" WHERE "publicSlug" = 'kijani-motors' AND "businessId" = 'BUS-DEMO-KIJANI'`);
  }
}
