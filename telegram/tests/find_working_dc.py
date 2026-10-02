"""
Probe each Telegram DC to find which ones are currently reachable.
DC addresses from Telegram's official documentation.
"""
import asyncio
import socket

DCS = {
    1: ("149.154.175.53",  443),
    2: ("149.154.167.41",  443),
    3: ("149.154.175.100", 443),
    4: ("149.154.167.91",  443),
    5: ("91.108.56.130",   443),
}

async def probe(dc_id, host, port, timeout=5.0):
    try:
        loop = asyncio.get_event_loop()
        conn = asyncio.open_connection(host, port)
        reader, writer = await asyncio.wait_for(conn, timeout=timeout)
        writer.close()
        await writer.wait_closed()
        print(f"  DC{dc_id} ({host}:{port})  ✓  REACHABLE")
        return dc_id
    except Exception as e:
        print(f"  DC{dc_id} ({host}:{port})  ✗  {e}")
        return None

async def main():
    print("Probing Telegram DCs …")
    tasks = [probe(dc_id, host, port) for dc_id, (host, port) in DCS.items()]
    results = await asyncio.gather(*tasks)
    reachable = [r for r in results if r is not None]
    print(f"\nReachable DCs: {reachable}")
    if reachable:
        print(f"Recommended: DC{reachable[0]}")

if __name__ == "__main__":
    asyncio.run(main())
