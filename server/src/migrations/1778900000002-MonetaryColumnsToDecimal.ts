import { MigrationInterface, QueryRunner } from 'typeorm';

export class MonetaryColumnsToDecimal1778900000002 implements MigrationInterface {
  name = 'MonetaryColumnsToDecimal1778900000002';

  private async alterIfExists(qr: QueryRunner, table: string, column: string, type = 'decimal(18,4)'): Promise<void> {
    await qr.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${table}' AND column_name = '${column}'
        ) THEN
          ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE ${type} USING "${column}"::${type};
        END IF;
      END $$;
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.alterIfExists(queryRunner, 'wallets', 'balance');
    await this.alterIfExists(queryRunner, 'payment_transactions', 'amount');
    await this.alterIfExists(queryRunner, 'credit_loans', 'principal');
    await this.alterIfExists(queryRunner, 'credit_loans', 'outstanding');
    await this.alterIfExists(queryRunner, 'credit_loans', 'interestRate');
    await this.alterIfExists(queryRunner, 'credit_loans', 'monthlyPayment');
    await this.alterIfExists(queryRunner, 'pos_products', 'price');
    await this.alterIfExists(queryRunner, 'pos_orders', 'subtotal');
    await this.alterIfExists(queryRunner, 'pos_orders', 'taxAmount');
    await this.alterIfExists(queryRunner, 'pos_orders', 'discountAmount');
    await this.alterIfExists(queryRunner, 'pos_orders', 'total');
    await this.alterIfExists(queryRunner, 'pos_order_items', 'unitPrice');
    await this.alterIfExists(queryRunner, 'pos_order_items', 'lineTotal');
    await this.alterIfExists(queryRunner, 'hotel_rooms', 'rate');
    await this.alterIfExists(queryRunner, 'hotel_bookings', 'totalAmount');
    await this.alterIfExists(queryRunner, 'subscriptions', 'price');
    await this.alterIfExists(queryRunner, 'discounts', 'value');
    await this.alterIfExists(queryRunner, 'discount_usages', 'discountAmount');
    await this.alterIfExists(queryRunner, 'properties', 'price');
    await this.alterIfExists(queryRunner, 'warehouse_items', 'costPrice');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.alterIfExists(queryRunner, 'wallets', 'balance', 'float');
    await this.alterIfExists(queryRunner, 'payment_transactions', 'amount', 'float');
  }
}
