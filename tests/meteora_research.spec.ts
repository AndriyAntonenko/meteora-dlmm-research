import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { MeteoraResearch } from "../target/types/meteora_research";
import { BankrunProvider } from "anchor-bankrun";
import { BanksClient, ProgramTestContext, startAnchor } from "solana-bankrun";
import { type Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
  program,
  SYSTEM_PROGRAM_ID,
} from "@coral-xyz/anchor/dist/cjs/native/system";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  createMint,
  mintTo,
  createAssociatedTokenAccount,
} from "spl-token-bankrun";
import { NATIVE_MINT_2022, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Decimal } from "decimal.js";

const IDL = require("../target/idl/meteora_research.json");

const LAMPORTS = new BN(1_000_000_000);
const CREATOR_BALANCE = new BN(1000).mul(LAMPORTS);
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const BASIS_POINT_MAX = 10000;

const METEORA_LB_CLMM = new PublicKey(
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
);

describe("meteora_research", () => {
  let creator: Keypair;
  let context: ProgramTestContext;
  let creatorProvider: BankrunProvider;
  let creatorProgram: Program<MeteoraResearch>;
  const mainnetConnection = new Connection(MAINNET_RPC);

  let banksClient: BanksClient;

  let token0Mint: PublicKey;
  let token1Mint: PublicKey;

  let creatorToken0ATA: PublicKey;
  let creatorToken1ATA: PublicKey;

  before(async () => {
    creator = new anchor.web3.Keypair();

    const [wrappedSolAccountInfo, meteoraLbClmm] = await Promise.all([
      mainnetConnection.getAccountInfo(NATIVE_MINT_2022),
      mainnetConnection.getAccountInfo(METEORA_LB_CLMM),
    ]);

    context = await startAnchor(
      "",
      [
        {
          name: "meteora_research",
          programId: new PublicKey(IDL.address),
        },
      ],
      [
        {
          address: NATIVE_MINT_2022,
          info: wrappedSolAccountInfo,
        },
        {
          address: METEORA_LB_CLMM,
          info: meteoraLbClmm,
        },
        {
          address: creator.publicKey,
          info: {
            lamports: Number(CREATOR_BALANCE),
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    );

    banksClient = context.banksClient;

    const meteoraMainnetAccount = await mainnetConnection.getAccountInfo(
      METEORA_LB_CLMM,
      "confirmed"
    );

    console.info("meteoraMainnetAccount", meteoraMainnetAccount);

    const meteoraAccount = await banksClient.getAccount(
      METEORA_LB_CLMM,
      "confirmed"
    );

    console.info("meteoraAccount", meteoraAccount);

    creatorProvider = new BankrunProvider(context, new NodeWallet(creator));
    creatorProgram = new Program(IDL, creatorProvider);

    const tokenXMint = await createMint(
      // @ts-expect-error
      banksClient,
      creator,
      creator.publicKey,
      null,
      2
    );

    const tokenYMint = await createMint(
      // @ts-expect-error
      banksClient,
      creator,
      creator.publicKey,
      null,
      2
    );

    token0Mint =
      tokenXMint.toString() > tokenYMint.toString() ? tokenYMint : tokenXMint;
    token1Mint =
      tokenXMint.toString() > tokenYMint.toString() ? tokenXMint : tokenYMint;

    creatorToken0ATA = await createAssociatedTokenAccount(
      // @ts-expect-error
      banksClient,
      creator,
      token0Mint,
      creator.publicKey
    );

    await mintTo(
      // @ts-expect-error
      banksClient,
      creator,
      token0Mint,
      creatorToken0ATA,
      creator,
      CREATOR_BALANCE.toNumber()
    );

    creatorToken1ATA = await createAssociatedTokenAccount(
      // @ts-expect-error
      banksClient,
      creator,
      token1Mint,
      creator.publicKey
    );

    await mintTo(
      // @ts-expect-error
      banksClient,
      creator,
      token1Mint,
      creatorToken1ATA,
      creator,
      CREATOR_BALANCE.toNumber()
    );
  });

  it("should initialize meteora pool", async () => {
    // calculate the initial price of
    const initialPrice = 0.001;
    const binStep = 100;
    const initialBin = (() => {
      const binStepNum = new Decimal(binStep).div(BASIS_POINT_MAX);
      const binId = new Decimal(initialPrice)
        .log()
        .dividedBy(new Decimal(1).add(binStepNum).log());
      return binId.ceil().toNumber();
    })();

    const [lbPair] = PublicKey.findProgramAddressSync(
      [
        new PublicKey("MFGQxwAmB91SwuYX36okv2Qmdc9aMuHTwWGUrp4AtB1").toBuffer(),
        token0Mint.toBuffer(),
        token1Mint.toBuffer(),
      ],
      METEORA_LB_CLMM
    );

    const [reservesToken0] = PublicKey.findProgramAddressSync(
      [lbPair.toBuffer(), token0Mint.toBuffer()],
      METEORA_LB_CLMM
    );

    const [reservesToken1] = PublicKey.findProgramAddressSync(
      [lbPair.toBuffer(), token1Mint.toBuffer()],
      METEORA_LB_CLMM
    );

    const [oracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle", "utf-8"), lbPair.toBuffer()],
      METEORA_LB_CLMM
    );

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority", "utf-8"), METEORA_LB_CLMM.toBuffer()],
      METEORA_LB_CLMM
    );

    const tx = await creatorProgram.methods
      .createMeteoraDlmm(initialBin)
      .accounts({
        token0Mint: token0Mint,
        token1Mint: token1Mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        funder: creator.publicKey,
        lbPair,
        reservesToken0,
        reservesToken1,
        oracle,
        eventAuthority,
      })
      .rpc();

    console.info("tx", tx);
  });
});
