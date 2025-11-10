"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";

// CoinGecko Token Price API (Multi-Query)
const COINGECKO_PRICE_API =
  "https://api.coingecko.com/api/v3/simple/token_price/base?vs_currencies=usd&contract_addresses=";

// Token Official / Stablecoin → Disembunyikan
const BLOCKLIST = [
  "0xd9aec86b65d86f6a7b5b1b0c42eff8ec28e46f2", // USDC Base
  "0x4200000000000000000000000000000000000006", // WETH Base
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
];

export default function TokenSelectList({ provider, onSelect }: any) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>({});

  useEffect(() => {
    if (!provider) return;

    (async () => {
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();

      const res = await fetch(
        `https://api.covalenthq.com/v1/base-mainnet/address/${wallet}/balances_v2/?key=${process.env.NEXT_PUBLIC_COVALENT_API_KEY}`
      );
      const data = await res.json();

      let list = data.data.items.filter(
        (t: any) =>
          t.type === "cryptocurrency" &&
          t.balance > 0 &&
          !BLOCKLIST.includes(t.contract_address.toLowerCase())
      );

      const contractAddrs = list.map((t: any) => t.contract_address).join(",");
      const priceReq = await fetch(COINGECKO_PRICE_API + contractAddrs);
      const priceData = await priceReq.json();

      list = list.map((t: any) => ({
        address: t.contract_address,
        symbol: t.contract_ticker_symbol,
        name: t.contract_name,
        logo: `https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/${t.contract_address}/logo.png`,
        balance: Number(ethers.formatUnits(t.balance, t.contract_decimals)),
        price: priceData[t.contract_address.toLowerCase()]?.usd || null,
      }));

      setTokens(list);
    })();
  }, [provider]);

  const toggleSelect = (token: any) => {
    const updated = { ...selected };
    if (updated[token.address]) delete updated[token.address];
    else updated[token.address] = token;
    setSelected(updated);
    onSelect(Object.values(updated));
  };

  return (
    <div className="w-full max-w-md bg-black/60 rounded-2xl p-4 border border-[#00ff00]/30 shadow-lg backdrop-blur-md">
      <h2 className="text-center text-[#00ff00] font-bold text-xl mb-3">
        Select Token to Burn
      </h2>

      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-2">
        {tokens.length === 0 && (
          <p className="text-center text-gray-400 text-sm">
            Loading tokens...
          </p>
        )}

        {tokens.map((t) => (
          <label
            key={t.address}
            className="flex items-center justify-between bg-black/40 hover:bg-black/70 p-3 rounded-xl border border-[#00ff00]/20 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <img
                src={t.logo}
                onError={(e) => (e.currentTarget.src = "/token-placeholder.png")}
                className="w-8 h-8 rounded-full border border-gray-500"
              />
              <div>
                <p className="text-white font-medium">{t.name}</p>
                <p className="text-gray-400 text-xs">
                  {t.balance.toFixed(4)} {t.symbol}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[#00ff00] text-sm font-semibold">
                {t.price ? `$${(t.price * t.balance).toFixed(2)}` : "—"}
              </p>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#00ff00]"
                checked={!!selected[t.address]}
                onChange={() => toggleSelect(t)}
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
