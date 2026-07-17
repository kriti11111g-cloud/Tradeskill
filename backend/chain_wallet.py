import os
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from bip_utils import Bip39SeedGenerator, Bip44, Bip44Coins, Bip44Changes

ERC20_ABI = [
    {"constant": True, "inputs": [{"name": "_owner", "type": "address"}],
     "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}],
     "type": "function"},
    {"constant": False,
     "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
     "name": "transfer", "outputs": [{"name": "", "type": "bool"}], "type": "function"},
]

NETWORKS = {
    "BEP20": {
        "rpc_env": "BSC_RPC_URL",
        "usdt": "0x55d398326f99059fF775485246999027B3197955",
        "decimals": 18,
        "chain_id": 56,
        "label": "BNB Smart Chain (BEP20)",
        "native": "BNB",
        "explorer": "https://bscscan.com/tx/",
    },
    "POLYGON": {
        "rpc_env": "POLYGON_RPC_URL",
        "usdt": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "decimals": 6,
        "chain_id": 137,
        "label": "Polygon",
        "native": "POL",
        "explorer": "https://polygonscan.com/tx/",
    },
}

_bip44_acct = None


def _acct():
    global _bip44_acct
    if _bip44_acct is None:
        mnemonic = os.environ["MASTER_MNEMONIC"]
        seed = Bip39SeedGenerator(mnemonic).Generate()
        _bip44_acct = (
            Bip44.FromSeed(seed, Bip44Coins.ETHEREUM)
            .Purpose().Coin().Account(0).Change(Bip44Changes.CHAIN_EXT)
        )
    return _bip44_acct


def derive_address(index: int) -> str:
    return _acct().AddressIndex(index).PublicKey().ToAddress()


def _derive_privkey(index: int) -> str:
    return _acct().AddressIndex(index).PrivateKey().Raw().ToHex()


def _w3(network: str) -> Web3:
    cfg = NETWORKS[network]
    w3 = Web3(Web3.HTTPProvider(os.environ[cfg["rpc_env"]], request_kwargs={"timeout": 15}))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def _usdt_contract(w3: Web3, network: str):
    return w3.eth.contract(
        address=Web3.to_checksum_address(NETWORKS[network]["usdt"]), abi=ERC20_ABI)


def get_usdt_balance(network: str, address: str) -> float:
    w3 = _w3(network)
    raw = _usdt_contract(w3, network).functions.balanceOf(
        Web3.to_checksum_address(address)).call()
    return raw / (10 ** NETWORKS[network]["decimals"])


def get_native_balance(network: str, address: str) -> float:
    w3 = _w3(network)
    return float(w3.from_wei(w3.eth.get_balance(Web3.to_checksum_address(address)), "ether"))


def send_usdt(network: str, to_address: str, amount: float, from_index: int = 0) -> str:
    """Send USDT from a derived wallet (default master index 0). Returns tx hash."""
    cfg = NETWORKS[network]
    w3 = _w3(network)
    acct = w3.eth.account.from_key(_derive_privkey(from_index))
    contract = _usdt_contract(w3, network)
    raw_amt = int(round(amount * (10 ** cfg["decimals"])))
    usdt_bal = contract.functions.balanceOf(acct.address).call()
    if usdt_bal < raw_amt:
        raise ValueError(
            f"Master wallet USDT insufficient on {cfg['label']}: "
            f"{usdt_bal / 10 ** cfg['decimals']:.2f} < {amount:.2f}")
    gas_price = int(w3.eth.gas_price * 1.15)
    tx = contract.functions.transfer(
        Web3.to_checksum_address(to_address), raw_amt
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 100000,
        "gasPrice": gas_price,
        "chainId": cfg["chain_id"],
    })
    native_bal = w3.eth.get_balance(acct.address)
    if native_bal < tx["gas"] * gas_price:
        raise ValueError(f"Not enough {cfg['native']} for gas in master wallet")
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return tx_hash.hex()
