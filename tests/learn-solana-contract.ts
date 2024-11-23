import * as anchor from '@project-serum/anchor';
import { SystemProgram } from '@solana/web3.js';
import { assert } from 'chai';
import { YourProgramName } from '../target/types/your_program_name';

describe('Your Program', () => {
    // Set up provider and program
    const provider = anchor.Provider.local();
    anchor.setProvider(provider);

    // Generate new accounts
    const user = anchor.web3.Keypair.generate();
    let dataAccount = anchor.web3.Keypair.generate();

    const program = anchor.workspace.YourProgramName as anchor.Program<YourProgramName>;

    before(async () => {
        // Airdrop some SOL to the user for testing
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(user.publicKey, 1000000000),
            'confirmed'
        );
    });

    it('Submit data successfully', async () => {
        // Define the arguments for the submit_data function
        const pdfHash = "abc123";
        const latitude = "37.7749";
        const longitude = "-122.4194";
        const price = 1000;
        const depositAmount = 5000000;

        // Submit data to the program
        const tx = await program.rpc.submitData(
            pdfHash,
            latitude,
            longitude,
            new anchor.BN(price),
            new anchor.BN(depositAmount), 
            {
                accounts: {
                    user: user.publicKey,
                    dataAccount: dataAccount.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [user, dataAccount],
            }
        );

        // Fetch the updated dataAccount
        const account = await program.account.dataAccount.fetch(dataAccount.publicKey);

        // Check if the account was initialized properly
        assert.equal(account.pdfHash, pdfHash);
        assert.equal(account.latitude, latitude);
        assert.equal(account.longitude, longitude);
        assert.equal(account.price.toNumber(), price);
        assert.equal(account.depositor.toString(), user.publicKey.toString());
        assert.isAtLeast(account.timestamp.toNumber(), Date.now() / 1000 - 60);  // Check timestamp is recent
        assert.equal(account.depositAmount.toNumber(), depositAmount);

        console.log("Data submitted successfully:", tx);
    });

    it('Withdraw funds after 10 seconds', async () => {
        // Ensure the program has a delay of at least 10 seconds before the withdrawal
        const initialTimestamp = Math.floor(Date.now() / 1000);
        await new Promise(resolve => setTimeout(resolve, 10000));  // Wait for 10 seconds

        // Withdraw the deposit
        const tx = await program.rpc.withdraw({
            accounts: {
                user: user.publicKey,
                dataAccount: dataAccount.publicKey,
                systemProgram: SystemProgram.programId,
            },
            signers: [user],
        });

        // Fetch the dataAccount to ensure funds were withdrawn
        const account = await program.account.dataAccount.fetch(dataAccount.publicKey);

        assert.isUndefined(account.pdfHash);  // Should be closed after withdrawal
        assert.isUndefined(account.latitude);
        assert.isUndefined(account.longitude);
        assert.equal(account.price.toNumber(), 0);  // Should be reset
        assert.isUndefined(account.depositor.toString());  // Should be cleared
        assert.equal(account.depositAmount.toNumber(), 0);  // Deposit should be zero

        console.log("Withdrawal successful:", tx);
    });

    it('Fail withdrawal if not the depositor', async () => {
        // Create a new user who is not the depositor
        const newUser = anchor.web3.Keypair.generate();
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(newUser.publicKey, 1000000000),
            'confirmed'
        );

        try {
            // Attempt to withdraw by a non-depositor
            await program.rpc.withdraw({
                accounts: {
                    user: newUser.publicKey,
                    dataAccount: dataAccount.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [newUser],
            });
            assert.fail("Withdrawal should have failed for non-depositor");
        } catch (err) {
            assert.equal(err.error.errorMessage, "Only the original depositor can withdraw the funds.");
        }
    });

    it('Fail withdrawal if 10 seconds have not passed', async () => {
        try {
            // Attempt to withdraw before 10 seconds have passed
            await program.rpc.withdraw({
                accounts: {
                    user: user.publicKey,
                    dataAccount: dataAccount.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [user],
            });
            assert.fail("Withdrawal should have failed as 10 seconds have not passed");
        } catch (err) {
            assert.equal(err.error.errorMessage, "Withdrawal is not yet allowed. Please wait for 10 seconds since submission.");
        }
    });
});
