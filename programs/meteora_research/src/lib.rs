pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("AJykLoVxP2yEYhvRR5zw69F9da4Q6C773kUErUDmJNMp");

declare_program!(lb_clmm);
pub mod meteora {
    pub use crate::lb_clmm::*;
}

#[program]
pub mod meteora_research {
    use super::*;

    pub fn create_meteora_dlmm(ctx: Context<CreateDLMM>, active_id: i32) -> Result<()> {
        create_dlmm(&ctx, active_id)
    }
}
