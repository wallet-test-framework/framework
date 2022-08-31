import { ethers } from "ethers";
import { test, hold } from "zora";
import { wallet, blockchain } from "../tests"

hold();

test('getBalance', async (t) => {

  await t.test('sending ether to address increases balance', async (t) => {
  	const src = (await blockchain.listAccounts())[0];
  	const dest = (await wallet.listAccounts())[0];
  	
  	const balance = "0x100000000000000000000";
  	const result = await blockchain.send("evm_setAccountBalance", [src, balance] );

  	const walletInitalBalance = await wallet.getBalance(dest);
  	const ganacheInitalBalance = await blockchain.getBalance(dest);

  	t.eq(walletInitalBalance.toString(), ganacheInitalBalance.toString(), "initalBalance");

  	const value = "0x1"
  	const response = await blockchain.getSigner(src).sendTransaction({
  		to: dest,
  		value: value
  	});

  	await blockchain.send("evm_mine", [{blocks: 5000}] );

  	const walletResponse = await (await wallet.getTransaction(response.hash)).wait(10);

  	const walletFinalBalance = await wallet.getBalance(dest);
  	const ganacheFinalBalance = await blockchain.getBalance(dest);

  	t.eq(walletFinalBalance.toString(), ganacheFinalBalance.toString(), "finalBalance");

  	const expected = ethers.BigNumber.from(value).add(walletInitalBalance);

  	t.eq(walletFinalBalance.toString(), expected.toString());
  });

});
