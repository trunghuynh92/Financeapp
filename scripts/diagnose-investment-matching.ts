import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function diagnose() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('=== Investment Matching Diagnostic ===\n')

    // Check investment contributions
    const contribQuery = `
      SELECT
        contribution_id,
        entity_id,
        investment_account_id,
        source_account_id,
        contribution_amount,
        contribution_date,
        main_transaction_id,
        created_at
      FROM investment_contribution
      ORDER BY created_at DESC
      LIMIT 5;
    `
    const contribResult = await client.query(contribQuery)
    console.log('Recent Investment Contributions:')
    console.table(contribResult.rows)

    // For each contribution, check if the linked transactions have investment_contribution_id set
    for (const contrib of contribResult.rows) {
      console.log(`\n--- Checking contribution ${contrib.contribution_id} ---`)

      // Check source transaction
      if (contrib.main_transaction_id) {
        const sourceQuery = `
          SELECT
            main_transaction_id,
            account_id,
            amount,
            transaction_type_id,
            investment_contribution_id
          FROM main_transaction
          WHERE main_transaction_id = $1;
        `
        const sourceResult = await client.query(sourceQuery, [contrib.main_transaction_id])
        console.log('Source transaction:')
        console.table(sourceResult.rows)
      }

      // Check for transactions in the investment account
      const investQuery = `
        SELECT
          main_transaction_id,
          account_id,
          amount,
          transaction_type_id,
          investment_contribution_id,
          transaction_date
        FROM main_transaction
        WHERE account_id = $1
          AND transaction_date = $2
          AND amount = $3
        ORDER BY created_at DESC
        LIMIT 2;
      `
      const investResult = await client.query(investQuery, [
        contrib.investment_account_id,
        contrib.contribution_date,
        contrib.contribution_amount
      ])
      console.log('Investment account transactions:')
      console.table(investResult.rows)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

diagnose()
