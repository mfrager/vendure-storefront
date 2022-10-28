import { PublicKey, Keypair, Connection, Transaction, SystemProgram, clusterApiUrl } from '@solana/web3.js'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { GlowWalletAdapter } from '@solana/wallet-adapter-glow'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { AnchorProvider, Program, BN, setProvider } from '@project-serum/anchor'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, createCloseAccountInstruction, AccountLayout, TokenAccountNotFoundError } from '@solana/spl-token'
import { create, all } from 'mathjs'
import { v4 as uuidv4, parse as uuidParse } from 'uuid'
import { DateTime } from 'luxon'
import { Buffer } from 'buffer'
import base32 from 'base32.js'
import bs58 from 'bs58'
//import Emitter from 'tiny-emitter'
//import $backend from '@/backend'

const SOLANA_NETWORK = 'devnet'
const ANCHOR_IDL = {
    'atx-net-authority': require('@/atellix/idl/net_authority.json'),
    'atx-swap-contract': require('@/atellix/idl/swap_contract.json'),
    'token-agent': require('@/atellix/idl/token_agent.json'),
    'token-delegate': require('@/atellix/idl/token_delegate.json'),
}

export default {
    init () {
        //this.eventbus = new Emitter()
        this.math = create(all, {
            number: 'BigNumber',
            precision: 64
        })
        this.oracleQuote = {}
        this.swapDataAccount = {}
    },
    getWalletAdapters(network) {
        return [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new GlowWalletAdapter(),
        ]
    },
    getWallets() {
        const network = WalletAdapterNetwork.Devnet
        //console.log('Get Wallet Adapters: ' + network)
        let adapters = this.getWalletAdapters(network)
        let wallets = []
        for (var i = 0; i < adapters.length; i++) {
            let adp = adapters[i]
            //console.log(adp.name + ': ' + adp.readyState)
            if (adp.readyState === 'Installed') {
                wallets.push(adp)
                //break
            }
            //console.log(adp)
        }
        return wallets
    },
    getProvider(adapter) {
        let apiUrl = clusterApiUrl(SOLANA_NETWORK)
        let wallet = {
            publicKey: adapter.publicKey,
            signTransaction: function (transaction) { return adapter.signTransaction(transaction) },
            signAllTransactions: function (transactions) { return adapter.signAllTransactions(transactions) }
        }
        let connection = new Connection(apiUrl, { commitment: 'confirmed' })
        let provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
        this.provider = provider
        return provider
    },
    updateNetData(data) {
        this.netData = data
    },
    updateOrderData(data) {
        this.orderData = data
    },
    updateSwapData(data) {
        this.swapData = data
    },
    updateRegister(data) {
        this.registerFn = data
    },
    loadProgram(name, pkey) {
        let provider = this.provider
        setProvider(provider)
        if (typeof this['program'] === 'undefined') {
            this.program = {}
        }
        if (typeof this.program[name] === 'undefined') {
            console.log('Load program')
            console.log(this.netData.program, pkey)
            console.log(this.netData.program[pkey])
            let programPK = new PublicKey(this.netData.program[pkey])
            this.program[name] = new Program(ANCHOR_IDL[pkey], programPK)
            /*if (name === 'swapContract') {
                let thiz = this
                //console.log('Add Event Listener: SwapEvent')
                this.program[name].addEventListener('SwapEvent', (evt, slot) => {
                    //console.log('Received Event: SwapEvent')
                    thiz.eventbus.emit('SwapEvent', evt, slot)
                })
            }*/
        }
    },
    async getLamports(wallet) {
        let walletPK = new PublicKey(wallet)
        let walletInfo = await this.provider.connection.getAccountInfo(walletPK, 'confirmed')
        if (walletInfo && typeof walletInfo['lamports'] !== 'undefined') {
            return walletInfo.lamports
        }
        return Number(0)
    },
    async getTokenBalance(mint, wallet) {
        //console.log(mint, wallet)
        let mintPK = new PublicKey(mint)
        //console.log('mintPK')
        //console.log(mintPK.toBase58())
        let walletPK = new PublicKey(wallet)
        //console.log('walletPK')
        //console.log(walletPK.toBase58())
        let tokenInfo = await this.associatedTokenAddress(walletPK, mintPK)
        let tokenPK = new PublicKey(tokenInfo.pubkey)
        let amount = '0'
        try {
            let tokenAccount = await getAccount(this.provider.connection, tokenPK)
            //console.log('Token Account - Wallet: ' + wallet + ' Mint: ' + mint)
            //console.log(tokenAccount)
            amount = tokenAccount.amount.toString()
        } catch (error) {
            if (error instanceof TokenAccountNotFoundError) {
                // Do nothing
            } else {
                console.error(error)
            }
        }
        return amount
    },
    async hasTokenAccount(ataPK) {
        try {
            await getAccount(this.provider.connection, ataPK)
        } catch (error) {
            return false
        }
        return true
    },
    async merchantCheckout(params) {
        //console.log('Checkout')
        //console.log(params)
        let provider = this.provider
        setProvider(provider)
        let tokenAgentPK = new PublicKey(this.netData.program['token-agent'])
        let tokenAgent = new Program(ANCHOR_IDL['token-agent'], tokenAgentPK)
        let netAuth = new PublicKey(this.netData.program['atx-net-authority'])

        let tokenMint = new PublicKey(this.orderData.tokenMint)
        let destPK = new PublicKey(this.orderData.merchantWallet)
        let merchantAP = new PublicKey(this.orderData.merchantApproval)
        let merchantTK = await this.associatedTokenAddress(destPK, tokenMint)
        let feesPK = new PublicKey(this.orderData.feesAccount)
        let feesTK = await this.associatedTokenAddress(feesPK, tokenMint)

        let rootKey = await this.programAddress([tokenAgentPK.toBuffer()], tokenAgentPK)
        let walletToken = await this.associatedTokenAddress(provider.wallet.publicKey, tokenMint)
        let tokenAccount = new PublicKey(walletToken.pubkey)

        let operationSpec = {
            accounts: {
                netAuth: netAuth,
                rootKey: new PublicKey(rootKey.pubkey),
                merchantApproval: merchantAP,
                merchantToken: new PublicKey(merchantTK.pubkey),
                userKey: provider.wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                tokenAccount: tokenAccount,
                feesAccount: new PublicKey(feesTK.pubkey),
            }
        }
    
        let bump_root = 0
        let bump_inb = 0
        let bump_out = 0
        let bump_dst = 0
        let swapDirection = false
        let tx = new Transaction()
        let unwrapSOL = false
        let walletTokenPK
        if (params.swap) {
            let swapSpec = this.swapData[params.swapKey]
            swapDirection = swapSpec.swapDirection
            let swapContractPK = new PublicKey(this.netData.program['atx-swap-contract'])
            let tokenMint1 = new PublicKey(swapSpec.tokenMint1)
            let tokenMint2 = new PublicKey(swapSpec.tokenMint2)
            let swapDataPK = new PublicKey(swapSpec.swapData)
            let swapFeesTK = new PublicKey(swapSpec.feesToken)
            let swapId = 0 // TODO: Make this dynamic
            let buf = Buffer.alloc(2)
            buf.writeInt16LE(swapId, 0)
            let swapData
            if (swapDirection) {
                swapData = await this.programAddress([tokenMint1.toBuffer(), tokenMint2.toBuffer(), buf], swapContractPK)
            } else {
                swapData = await this.programAddress([tokenMint2.toBuffer(), tokenMint1.toBuffer(), buf], swapContractPK)
            }
            let tokData1 = await this.associatedTokenAddress(swapDataPK, tokenMint1)
            let tokData2 = await this.associatedTokenAddress(swapDataPK, tokenMint2)
            let agentToken = await this.associatedTokenAddress(new PublicKey(rootKey.pubkey), tokenMint)
            //console.log('Root Key: ' + rootKey.pubkey)
            tokenAccount = new PublicKey(agentToken.pubkey)
            //console.log('Token Account: ' + agentToken.pubkey)
            walletToken = await this.associatedTokenAddress(provider.wallet.publicKey, tokenMint1)
            walletTokenPK = new PublicKey(walletToken.pubkey)
            bump_root = swapData.nonce
            bump_inb = tokData1.nonce
            bump_out = tokData2.nonce
            bump_dst = agentToken.nonce
            let remainAccts = [
                { pubkey: walletTokenPK, isWritable: true, isSigner: false },
                { pubkey: swapContractPK, isWritable: false, isSigner: false },
                { pubkey: swapDataPK, isWritable: true, isSigner: false },
                { pubkey: new PublicKey(tokData1.pubkey), isWritable: true, isSigner: false },
                { pubkey: new PublicKey(tokData2.pubkey), isWritable: true, isSigner: false },
                { pubkey: swapFeesTK, isWritable: true, isSigner: false },
            ]
            if (typeof swapSpec['oracleChain'] !== 'undefined') {
                remainAccts.push({ pubkey: new PublicKey(swapSpec.oracleChain), isWritable: false, isSigner: false })
            }
            operationSpec['accounts']['tokenAccount'] = tokenAccount
            operationSpec['remainingAccounts'] = remainAccts
            if (params.wrapSOL) {
                //console.log('Wrap Estimate: ' + params.wrapAmount)
                let wrapAmount = params.wrapAmount
                let walletSOL = await this.getLamports(provider.wallet.publicKey)
                if (Number(params.wrapAmount) > walletSOL) {
                    let minimumSOL = Number(0.01 * (10 ** 9))
                    wrapAmount = walletSOL - minimumSOL
                }
                let hasWSOL = await this.hasTokenAccount(walletTokenPK)
                if (!hasWSOL) {
                    unwrapSOL = true // Unwrap the remaining SOL after the payment
                    //let size = AccountLayout.span
                    //let rent = await provider.connection.getMinimumBalanceForRentExemption(size)
                    //wrapAmount = wrapAmount - rent
                    tx.add(createAssociatedTokenAccountInstruction(
                        provider.wallet.publicKey,
                        walletTokenPK,
                        provider.wallet.publicKey,
                        tokenMint1,
                    ))
                }
                //console.log('Wrap Amount: ' + wrapAmount.toString())
                tx.add(SystemProgram.transfer({
                    fromPubkey: provider.wallet.publicKey,
                    lamports: wrapAmount.toString(),
                    toPubkey: walletTokenPK,
                }))
                tx.add(createSyncNativeInstruction(walletTokenPK))
            }
        }
        let txid
        try {
            let paymentUuid = uuidParse(this.orderData.orderId)
            tx.add(tokenAgent.instruction.merchantPayment(
                merchantTK.nonce,                        // inp_merchant_nonce (merchant associated token account nonce)
                rootKey.nonce,                           // inp_root_nonce
                new BN(paymentUuid),                     // inp_payment_id
                new BN(params.tokensTotal),              // inp_amount
                params.swap,                             // inp_swap
                swapDirection,                           // inp_swap_direction
                0,                                       // inp_swap_mode
                bump_root,                               // inp_swap_data_nonce
                bump_inb,                                // inp_swap_inb_nonce
                bump_out,                                // inp_swap_out_nonce
                bump_dst,                                // inp_swap_dst_nonce
                operationSpec,
            ))
            if (unwrapSOL) {
                tx.add(createCloseAccountInstruction(
                    walletTokenPK,
                    provider.wallet.publicKey,
                    provider.wallet.publicKey,
                ))
            }
            provider.opts['skipPreflight'] = true
            txid = await provider.registerAndSend(tx, async (sig) => {
                return await this.registerFn(bs58.encode(sig))
            })
        } catch (error) {
            return {
                'result': 'error',
                'error': error
            }
        }
        //console.log('Subscribed: ' + subscrDataPK.toString())
        return {
            'result': 'ok',
            'uuid': this.orderData.orderId,
            'transaction_sig': txid
        }
    },
    async associatedTokenAddress(walletAddress, tokenMintAddress) {
        const addr = await PublicKey.findProgramAddress(
            [walletAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMintAddress.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
        const res = { 'pubkey': await addr[0].toString(), 'nonce': addr[1] }
        return res
    },
    async programAddress(inputs, program) {
        const addr = await PublicKey.findProgramAddress(inputs, program)
        const res = { 'pubkey': await addr[0].toString(), 'nonce': addr[1] }
        return res
    },
    async getAccount(programKey, accountType, account) {
        let provider = this.provider
        setProvider(provider)
        let programPK = new PublicKey(this.netData.program[programKey])
        let program = new Program(ANCHOR_IDL[programKey], programPK)
        //console.log(program.account)
        let data = await program.account[accountType].fetch(new PublicKey(account))
        return data
    },
    exportSecretKey(keyPair) {
        var enc = new base32.Encoder({ type: "crockford", lc: true })
        return enc.write(keyPair.secretKey).finalize()
    },
    importSecretKey(keyStr) {
        var dec = new base32.Decoder({ type: "crockford" })
        var spec = dec.write(keyStr).finalize()
        return Keypair.fromSecretKey(new Uint8Array(spec))
    },
    async getSwapDataAccount(swapDataPK) {
        var sd
        if (typeof this.swapDataAccount[swapDataPK] === 'undefined') {
            sd = await this.getAccount('atx-swap-contract', 'swapData', swapDataPK)
            this.swapDataAccount[swapDataPK] = sd
        } else {
            sd = this.swapDataAccount[swapDataPK]
        }
        return sd
    },
    async quoteAmount(toToken, fromToken, swapInfo, fromAmount, swapKey, orderType = 'sell') {
        //console.log(fromToken)
        //console.log('quoteAmount: ' + swapKey)
        //console.log(toToken, fromToken, fromAmount)
        //console.log('Swap Data: ' + swapInfo.swapData)
        let swapData = await this.getSwapDataAccount(swapInfo.swapData)
        //console.log(swapData)
        let swapToken
        if (swapInfo.swapDirection) {
            swapToken = swapData.inbTokenData
        } else {
            swapToken = swapData.outTokenData
        }
        let useOracle = swapToken.oracleRates
        let oracleInverse = swapToken.oracleInverse
        let oracleMax = swapToken.oracleMax
        let swapRate
        let baseRate
        if (!fromAmount.length) {
            fromAmount = '0'
        }
        fromAmount = fromAmount.replace(/,/g, '')
        if (useOracle) {
            //console.log('Use Oracle')
            let decimalDiff = this.math.evaluate('idc - odc', {
                idc: fromToken.decimals,
                odc: toToken.decimals,
            })
            decimalDiff = this.math.abs(decimalDiff)
            //console.log('Current Oracle Quote: ' + this.oracleQuote[swapInfo['oracleTrack']])
            var oracleVal = Number.parseFloat(this.oracleQuote[swapInfo['oracleTrack']]).toFixed(6)
            //console.log('Oracle Value: ' + oracleVal)
            if (oracleMax) {
                oracleVal = this.math.max(
                    oracleVal,
                    this.math.evaluate('val / (10 ^ 8)', { val: swapToken.rateSwap.toString() })
                )
            }
            if (oracleInverse) {
                baseRate = this.math.evaluate('10 ^ ddf', { ddf: decimalDiff })
                swapRate = oracleVal
            } else {
                swapRate = this.math.evaluate('10 ^ ddf', { ddf: decimalDiff })
                baseRate = oracleVal
            }
        } else {
            swapRate = swapToken.rateSwap.toString()
            baseRate = swapToken.rateBase.toString()
        }
        let feeRate = swapToken.feesBps.toString()
        let fnOutput
        //console.log('Input: ' + fromAmount)
        //console.log('Use Oracle: ' + useOracle + ' Inverse: ' + oracleInverse)
        //console.log('Swap Rate: ' + swapRate + ' Base Rate: ' + baseRate + ' Fees BPS: ' + feeRate)
        //console.log('Inb Decimals: ' + fromToken.decimals + ' Out Decimals: ' + toToken.decimals)
        let fromTokens
        let viewStr
        if (orderType === 'sell') {
            let inAmount = this.math.evaluate('inp * (10 ^ dcm)', {
                inp: fromAmount,
                dcm: fromToken.decimals
            })
            let inTokens = this.math.floor(inAmount)
            fromTokens = inTokens
            //console.log('Sell Tokens: ' + inTokens)
            fnOutput = this.math.evaluate('((inp - (inp * (fee / 10000))) * brt) / srt', {
                inp: inTokens,
                fee: feeRate,
                brt: baseRate,
                srt: swapRate
            })
            fnOutput = this.math.floor(fnOutput)
            let viewOutput = this.math.evaluate('out / (10 ^ dcm)', {
                out: fnOutput,
                dcm: toToken.decimals
            })
            viewStr = Number.parseFloat(viewOutput.toString()).toFixed(toToken.viewDecimals)
        } else if (orderType === 'buy') {
            let outAmount = this.math.evaluate('inp * (10 ^ dcm)', {
                inp: fromAmount,
                dcm: toToken.decimals
            })
            let outTokens = this.math.floor(outAmount)
            fromTokens = outTokens
            //console.log('Buy Tokens: ' + outTokens)
            fnOutput = this.math.evaluate('((out + (out * (fee / 10000))) * srt) / brt', {
                out: outTokens,
                fee: feeRate,
                brt: baseRate,
                srt: swapRate
            })
            fnOutput = this.math.floor(fnOutput)
            let viewOutput = this.math.evaluate('out / (10 ^ dcm)', {
                out: fnOutput,
                dcm: fromToken.decimals
            })
            viewStr = Number.parseFloat(viewOutput.toString()).toFixed(fromToken.viewDecimals)
        }
        //console.log('Output: ' + fnOutput.toString() + ' View: ' + viewStr)
        //console.log('-')
        return {'amount': fnOutput.toString(), 'viewAmount': viewStr, 'fromAmountTokens': fromTokens.toString()}
    },
    viewTokens(tokenSpec, tokens) {
        let viewOutput = this.math.evaluate('out / (10 ^ dcm)', {
            out: tokens,
            dcm: tokenSpec.decimals
        })
        return Number.parseFloat(viewOutput.toString()).toFixed(tokenSpec.viewDecimals)
    },
}
