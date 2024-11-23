use anchor_lang::prelude::*;

declare_id!("48zQM2WJcVtJYyv2gf2PqsCYawgFkEW9ZqrT61DTAZ7J");

#[program]
pub mod learn_solana_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
