import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert all monetary float columns to decimal(18,4) to avoid IEEE 754
 * rounding errors in financial calculations.
 */
export class MonetaryColumnsToDecimal1778900000002 implements MigrationInterface {
  name = 'MonetaryColumnsToDecimal1778900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Wallets
    await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "balance" TYPE decimal(18,4) USING "balance"::decimal`);

    // Payment transactions
    await queryRunner.query(`ALTER TABLE "payment_transactions" ALTER COLUMN "amount" TYPE decimal(18,4) USING "amount"::decimal`);

    // Credit loans
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "principal" TYPE decimal(18,4) USING "principal"::decimal`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "outstanding" TYPE decimal(18,4) USING "outstanding"::decimal`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "interestRate" TYPE decimal(18,4) USING "interestRate"::decimal`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "monthlyPayment" TYPE decimal(18,4) USING "monthlyPayment"::decimal`);

    // POS products
    await queryRunner.query(`ALTER TABLE "pos_products" ALTER COLUMN "price" TYPE decimal(18,4) USING "price"::decimal`);

    // POS orders
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "subtotal" TYPE decimal(18,4) USING "subtotal"::decimal`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "taxAmount" TYPE decimal(18,4) USING "taxAmount"::decimal`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "discountAmount" TYPE decimal(18,4) USING "discountAmount"::decimal`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "total" TYPE decimal(18,4) USING "total"::decimal`);

    // POS order items
    await queryRunner.query(`ALTER TABLE "pos_order_items" ALTER COLUMN "unitPrice" TYPE decimal(18,4) USING "unitPrice"::decimal`);
    await queryRunner.query(`ALTER TABLE "pos_order_items" ALTER COLUMN "lineTotal" TYPE decimal(18,4) USING "lineTotal"::decimal`);

    // Hotel rooms
    await queryRunner.query(`ALTER TABLE "hotel_rooms" ALTER COLUMN "rate" TYPE decimal(18,4) USING "rate"::decimal`);

    // Hotel bookings
    await queryRunner.query(`ALTER TABLE "hotel_bookings" ALTER COLUMN "totalAmount" TYPE decimal(18,4) USING "totalAmount"::decimal`);

    // Subscriptions
    await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "price" TYPE decimal(18,4) USING "price"::decimal`);

    // Discounts
    await queryRunner.query(`ALTER TABLE "discounts" ALTER COLUMN "value" TYPE decimal(18,4) USING "value"::decimal`);
    await queryRunner.query(`ALTER TABLE "discount_usages" ALTER COLUMN "discountAmount" TYPE decimal(18,4) USING "discountAmount"::decimal`);

    // Property
    await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "price" TYPE decimal(18,4) USING "price"::decimal`);

    // Warehouse cost price
    await queryRunner.query(`ALTER TABLE "warehouse_items" ALTER COLUMN "costPrice" TYPE decimal(18,4) USING "costPrice"::decimal`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "balance" TYPE float USING "balance"::float`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" ALTER COLUMN "amount" TYPE float USING "amount"::float`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "principal" TYPE float USING "principal"::float`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "outstanding" TYPE float USING "outstanding"::float`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "interestRate" TYPE float USING "interestRate"::float`);
    await queryRunner.query(`ALTER TABLE "credit_loans" ALTER COLUMN "monthlyPayment" TYPE float USING "monthlyPayment"::float`);
    await queryRunner.query(`ALTER TABLE "pos_products" ALTER COLUMN "price" TYPE float USING "price"::float`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "subtotal" TYPE float USING "subtotal"::float`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "taxAmount" TYPE float USING "taxAmount"::float`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "discountAmount" TYPE float USING "discountAmount"::float`);
    await queryRunner.query(`ALTER TABLE "pos_orders" ALTER COLUMN "total" TYPE float USING "total"::float`);
    await queryRunner.query(`ALTER TABLE "pos_order_items" ALTER COLUMN "unitPrice" TYPE float USING "unitPrice"::float`);
    await queryRunner.query(`ALTER TABLE "pos_order_items" ALTER COLUMN "lineTotal" TYPE float USING "lineTotal"::float`);
    await queryRunner.query(`ALTER TABLE "hotel_rooms" ALTER COLUMN "rate" TYPE float USING "rate"::float`);
    await queryRunner.query(`ALTER TABLE "hotel_bookings" ALTER COLUMN "totalAmount" TYPE float USING "totalAmount"::float`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "price" TYPE float USING "price"::float`);
    await queryRunner.query(`ALTER TABLE "discounts" ALTER COLUMN "value" TYPE float USING "value"::float`);
    await queryRunner.query(`ALTER TABLE "discount_usages" ALTER COLUMN "discountAmount" TYPE float USING "discountAmount"::float`);
    await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "price" TYPE float USING "price"::float`);
    await queryRunner.query(`ALTER TABLE "warehouse_items" ALTER COLUMN "costPrice" TYPE float USING "costPrice"::float`);
  }
}
