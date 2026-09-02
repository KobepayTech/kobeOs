import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The previous Discounts UI automatically persisted a large sample catalogue on
 * first open. Remove it only for owners who clearly match that fixture pattern.
 */
export class RemoveSeededDiscountFixtures1785500000000 implements MigrationInterface {
  name = 'RemoveSeededDiscountFixtures1785500000000';

  private owners = `
    SELECT "ownerId" FROM "coupons"
    WHERE "code" IN ('SAVE10','SUMMER25','BULK20','LOYAL15','WELCOME5K','FLASH50','WEEKEND','STAFF30','CLEAR40','BDAY50','REFER10K','FIRSTBUY','HOLIDAY','NEWYEAR','SPECIAL')
    GROUP BY "ownerId" HAVING COUNT(*) >= 5
    UNION
    SELECT "ownerId" FROM "discount_rules"
    WHERE "name" IN ('Summer Sale','Bulk Buy','New Customer','Flash Sale','Loyalty Reward','Clearance','Weekend Special','Staff Discount','Birthday','Referral')
    GROUP BY "ownerId" HAVING COUNT(*) >= 5
  `;

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DELETE FROM "coupons"
      WHERE "ownerId" IN (${this.owners})
        AND "code" IN ('SAVE10','SUMMER25','BULK20','LOYAL15','WELCOME5K','FLASH50','WEEKEND','STAFF30','CLEAR40','BDAY50','REFER10K','FIRSTBUY','HOLIDAY','NEWYEAR','SPECIAL')
    `);
    await q.query(`
      DELETE FROM "discount_rules"
      WHERE "ownerId" IN (${this.owners})
        AND "name" IN ('Summer Sale','Bulk Buy','New Customer','Flash Sale','Loyalty Reward','Clearance','Weekend Special','Staff Discount','Birthday','Referral')
    `);
    await q.query(`
      DELETE FROM "campaigns"
      WHERE "ownerId" IN (${this.owners})
        AND "name" IN ('Summer Splash Sale','Back to School','Black Friday Early','New Year Blowout','Flash Friday')
    `);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Fabricated promotions are intentionally not recreated.
  }
}
