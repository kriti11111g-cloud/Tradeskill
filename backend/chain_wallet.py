import os
import time
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from bip_utils import Bip39SeedGenerator, Bip44, Bip44Coins, Bip44Changes

# keccak("Transfer(address,address,uint256)")
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# Backup public RPCs — primary fail hone par auto-rotate
_DEFAULT_BACKUPS = {
    "BEP20": ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org",
              "https://bsc-rpc.publicnode.com"],
    "POLYGON": ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
}
_rpc_idx = {}

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


def _rpc_urls(network: str) -> list:
    cfg = NETWORKS[network]
    urls = [u.strip() for u in os.environ[cfg["rpc_env"]].split(",") if u.strip()]
    extra = os.environ.get(cfg["rpc_env"] + "_BACKUP", "")
    urls += [u.strip() for u in extra.split(",") if u.strip()]
    urls += [u for u in _DEFAULT_BACKUPS.get(network, []) if u not in urls]
    return urls


def rotate_rpc(network: str):
    """Current RPC fail — agla backup RPC use karo."""
    _rpc_idx[network] = _rpc_idx.get(network, 0) + 1


def _w3(network: str) -> Web3:
    urls = _rpc_urls(network)
    url = urls[_rpc_idx.get(network, 0) % len(urls)]
    w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 8}))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def get_latest_block(network: str) -> int:
    return _w3(network).eth.block_number


def get_usdt_transfers_to(network: str, addresses: list, from_block: int, to_block: int) -> list:
    """Event-based detection: USDT Transfer logs jinka `to` hamare deposit addresses me hai.
    Public RPCs ki getLogs limit ke liye 10-block chunks me scan hota hai."""
    cfg = NETWORKS[network]
    w3 = _w3(network)
    topic_addrs = ["0x" + ("0" * 24) + a.lower().replace("0x", "") for a in addresses]
    out = []
    start = from_block
    while start <= to_block:
        end = min(start + 9, to_block)
        logs = w3.eth.get_logs({
            "address": Web3.to_checksum_address(cfg["usdt"]),
            "fromBlock": start, "toBlock": end,
            "topics": [TRANSFER_TOPIC, None, topic_addrs],
        })
        for lg in logs:
            to_addr = "0x" + bytes(lg["topics"][2])[-20:].hex()
            value = int.from_bytes(bytes(lg["data"]), "big") / (10 ** cfg["decimals"])
            txh = lg["transactionHash"].hex()
            out.append({"to": to_addr, "value": value,
                        "tx_hash": txh if txh.startswith("0x") else "0x" + txh,
                        "block": lg["blockNumber"]})
        start = end + 1
    return out


def wait_receipt(network: str, tx_hash: str, timeout: int = 120):
    return _w3(network).eth.wait_for_transaction_receipt(tx_hash, timeout=timeout, poll_latency=0.5)


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


def sweep_usdt(network: str, from_index: int, to_address: str, min_amount: float = 1.0) -> dict:
    """User deposit address (HD index) ka pura USDT cold wallet me sweep karta hai.
    Deposit address par gas kam ho to master gas wallet (index 0) se native top-up hota hai."""
    cfg = NETWORKS[network]
    w3 = _w3(network)
    acct = w3.eth.account.from_key(_derive_privkey(from_index))
    contract = _usdt_contract(w3, network)
    raw_bal = contract.functions.balanceOf(acct.address).call()
    amount = raw_bal / (10 ** cfg["decimals"])
    if amount < min_amount:
        return {"swept": False, "reason": f"balance {amount:.4f} < min {min_amount}"}

    # Node ka live gas price + 20% buffer (BSC ab ~0.05 gwei chalta hai — koi bada floor NahI)
    _floor = {"BEP20": Web3.to_wei(0.05, "gwei"), "POLYGON": Web3.to_wei(25, "gwei")}
    gas_price = max(int(w3.eth.gas_price * 1.2), int(_floor.get(network, 0)))

    # Exact gas estimate (USDT transfer ~35k) — sirf utna hi bhejo jitna lagega
    to_checksum = Web3.to_checksum_address(to_address)
    try:
        gas_limit = int(contract.functions.transfer(to_checksum, raw_bal)
                        .estimate_gas({"from": acct.address}) * 1.15)
    except Exception:
        gas_limit = 60000
    gas_needed = gas_limit * gas_price
    native_bal = w3.eth.get_balance(acct.address)
    gas_tx = None
    if native_bal < gas_needed:
        master = w3.eth.account.from_key(_derive_privkey(0))
        topup = int(gas_needed * 1.05) - native_bal
        master_native = w3.eth.get_balance(master.address)
        if master_native < topup + 21000 * gas_price:
            raise ValueError(
                f"Gas wallet me {cfg['native']} insufficient "
                f"({w3.from_wei(master_native, 'ether')} {cfg['native']}) — sweep skip")
        tx = {
            "to": acct.address, "value": topup,
            "gas": 21000, "gasPrice": gas_price,
            "nonce": w3.eth.get_transaction_count(master.address),
            "chainId": cfg["chain_id"],
        }
        signed = master.sign_transaction(tx)
        gas_tx = w3.eth.send_raw_transaction(signed.raw_transaction).hex()
        w3.eth.wait_for_transaction_receipt(gas_tx, timeout=45, poll_latency=0.5)

    tx = contract.functions.transfer(
        to_checksum, raw_bal
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": gas_limit,
        "gasPrice": gas_price,
        "chainId": cfg["chain_id"],
    })
    signed = acct.sign_transaction(tx)
    sweep_tx = w3.eth.send_raw_transaction(signed.raw_transaction).hex()
    return {"swept": True, "amount": amount, "sweep_tx": sweep_tx, "gas_tx": gas_tx,
            "from_address": acct.address, "to_address": to_address}
