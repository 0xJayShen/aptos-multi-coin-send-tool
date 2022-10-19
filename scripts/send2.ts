
import { AptosAccount, AptosClient, HexString, MaybeHexString, TxnBuilderTypes, CoinClient } from "aptos";
import fs from "fs";

const TESTNET_URL = "https://testnet.aptoslabs.com";
const client = new AptosClient(TESTNET_URL);

async function waitForTransaction(txnHash: string) {
  let count = 0;
  while (count < 10) {
    let tx = await client.getTransactionByHash(txnHash)
    let isPending = tx.type == "pending_transaction"
    if (!isPending) {
      console.log(tx)
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    count += 1;
    if (count >= 10) {
      throw new Error(`Waiting for transaction ${txnHash} timed out!`);
    }
  }
}

async function getBalance(accountAddress: MaybeHexString): Promise<string | number> {
  try {
    const resource = await client.getAccountResource(
      accountAddress,
      "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
    );

    return parseInt((resource.data as any)["coin"]["value"]);
  } catch (_) {
    return 0;
  }
}


async function runScript(sender: AptosAccount, dir: string, packagename: string, tokenaddr1: string, tokenaddr2: string, bob: HexString, amount1: string, amount2: string): Promise<string> {
  try {
    const moduleHex = fs.readFileSync(`${dir}/build/${packagename}/bytecode_scripts/main.mv`).toString("hex");
    const token1 = new TxnBuilderTypes.TypeTagStruct(
      TxnBuilderTypes.StructTag.fromString(tokenaddr1),
    );
    const token2 = new TxnBuilderTypes.TypeTagStruct(
      TxnBuilderTypes.StructTag.fromString(tokenaddr2),
    );
    const script = new TxnBuilderTypes.Script(
      new HexString(moduleHex).toUint8Array(),
      [token1, token2],
      [
        new TxnBuilderTypes.TransactionArgumentAddress(TxnBuilderTypes.AccountAddress.fromHex(bob)),
        new TxnBuilderTypes.TransactionArgumentU64(BigInt(amount1)),
        new TxnBuilderTypes.TransactionArgumentU64(BigInt(amount2))
      ])
    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScript(script);
    const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
      client.getAccount(sender.address()),
      client.getChainId(),
    ]);
    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(sender.address()),
      BigInt(sequenceNumber),
      scriptFunctionPayload,
      100000n,
      1000n,
      BigInt(Math.floor(Date.now() / 1000) + 60),
      new TxnBuilderTypes.ChainId(chainId),
    );
    const bcsTxn = AptosClient.generateBCSTransaction(sender, rawTxn);
    const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
    console.log(`runScript ${pendingTxn.hash}`);
    await waitForTransaction(pendingTxn.hash);
    return pendingTxn.hash;
  } catch (e) {
    console.log(e)
    return "runScript error";
  }
}



/** run our demo! */
async function main() {

  // Create two accounts, Alice and Bob, and fund Alice but not Bob
  const alice = new AptosAccount();
  const bob = new AptosAccount();

  console.log("\n=== Initial Balances ===");
  console.log(`Alice: ${await getBalance(alice.address())}`);
  console.log(`Bob: ${await getBalance(bob.address())}`);

  let token1 = "0x1::aptos_coin::AptosCoin";
  let token2 = "0x1::aptos_coin::AptosCoin";

  await runScript(alice, "send2", "Send2", token1, token2, bob.address(), "1000", "1000")

  return "success"
}

if (require.main === module) {
  main().then((resp) => console.log(resp));
}


