import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { Status } from "../../components/ui/Status";

export function SubmissionHistory({ isAdmin, toast }) {
  const [rows,setRows]=useState([["ADJ-0241","Croissant Butter","10 → 8","Selisih stok opname","Dina Maharani","Menunggu Admin"],["ADJ-0240","Matcha Latte","14 → 13","Produk rusak","Dina Maharani","Disetujui"],["ADJ-0239","Mineral Water","60 → 58","Botol bocor","Alya Pratama","Ditolak"]]);
  return <div className="card overflow-hidden"><div className="p-4"><h3 className="text-sm font-bold">Riwayat Pengajuan Penyesuaian</h3></div><table className="w-full"><thead className="table-head"><tr><th className="px-4 py-3">ID</th><th>Produk</th><th>Perubahan</th><th>Alasan</th><th>Pengaju</th><th>Status</th>{isAdmin&&<th className="pr-4 text-right">Aksi</th>}</tr></thead><tbody>{rows.map((r,idx)=><tr key={r[0]}>{r.map((x,i)=><td className="table-cell" key={i}>{i===5?<Status value={x}/>:x}</td>)}{isAdmin&&<td className="table-cell text-right">{r[5]==="Menunggu Admin"&&<><button className="mr-1 rounded-md bg-emerald-50 p-2 text-emerald-600" onClick={()=>{setRows(rows.map((x,i)=>i===idx?[...x.slice(0,5),"Disetujui"]:x));toast("Pengajuan disetujui, stok diperbarui")}}><Check size={14}/></button><button className="rounded-md bg-red-50 p-2 text-red-500"><X size={14}/></button></>}</td>}</tr>)}</tbody></table></div>;
}
