use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::meteora::{
    cpi::{
        accounts::InitializeCustomizablePermissionlessLbPair,
        initialize_customizable_permissionless_lb_pair,
    },
    program::LbClmm,
    types::CustomizableParams,
    ID as METEORA_PROGRAM_ID,
};

const ILM_BASE_KEY: Pubkey = pubkey!("MFGQxwAmB91SwuYX36okv2Qmdc9aMuHTwWGUrp4AtB1");
const ORACLE: &[u8] = b"oracle";

#[derive(Accounts)]
pub struct CreateDLMM<'info> {
    #[account(
        address = METEORA_PROGRAM_ID
    )]
    pub meteora_program: Program<'info, LbClmm>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub token0_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(constraint = token0_mint.key() < token1_mint.key())]
    pub token1_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            ILM_BASE_KEY.as_ref(),
            token0_mint.key().as_ref(),
            token1_mint.key().as_ref(),
        ],
        seeds::program = meteora_program.key(),
        bump,
    )]
    /// CHECK: No checks are performed
    pub lb_pair: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            lb_pair.key().as_ref(),
            token0_mint.key().as_ref(),
        ],
        bump,
        seeds::program = meteora_program.key(),
    )]
    /// CHECK: No checks are performed
    pub reserves_token0: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            lb_pair.key().as_ref(),
            token1_mint.key().as_ref(),
        ],
        bump,
        seeds::program = meteora_program.key(),
    )]
    /// CHECK: No checks are performed
    pub reserves_token1: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            ORACLE,
            lb_pair.key().as_ref(),
        ],
        bump,
        seeds::program = meteora_program.key(),
    )]
    /// CHECK: No checks are performed
    pub oracle: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = funder,
        associated_token::authority = funder,
        associated_token::mint = token0_mint,
        associated_token::token_program = token_program,
    )]
    pub funder_token0_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = funder,
        associated_token::authority = funder,
        associated_token::mint = token1_mint,
        associated_token::token_program = token_program,
    )]
    pub funder_token1_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_dlmm(ctx: &Context<CreateDLMM>, active_id: i32) -> Result<()> {
    let bin_step: u16 = 100;
    let padding: [u8; 64] = [0; 64];
    let fee_bps: u16 = 500;
    let lp_params = CustomizableParams {
        bin_step,
        has_alpha_vault: false,
        padding,
        base_factor: fee_bps,
        active_id,
        activation_type: 1, // Time
        activation_point: Some(Clock::get()?.unix_timestamp as u64),
    };

    let cpi_accounts = InitializeCustomizablePermissionlessLbPair {
        funder: ctx.accounts.funder.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        lb_pair: ctx.accounts.lb_pair.to_account_info(),
        bin_array_bitmap_extension: None,

        token_mint_x: ctx.accounts.token0_mint.to_account_info(),
        reserve_x: ctx.accounts.reserves_token0.to_account_info(),

        token_mint_y: ctx.accounts.token1_mint.to_account_info(),
        reserve_y: ctx.accounts.reserves_token1.to_account_info(),

        user_token_x: ctx.accounts.funder_token0_account.to_account_info(),

        program: ctx.accounts.meteora_program.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),

        event_authority: ctx.accounts.meteora_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.meteora_program.to_account_info(), cpi_accounts);

    msg!("Calling initialize_customizable_permissionless_lb_pair");
    initialize_customizable_permissionless_lb_pair(cpi_ctx, lp_params)?;
    Ok(())
}
