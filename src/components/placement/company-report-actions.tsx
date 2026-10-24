"use client";
import {useState} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {fieldClass,mutate} from "./forms";
export function CompanyReportActions({token,candidates}:{token:string;candidates:{id:string;name:string}[]}) {
  const [busy,setBusy]=useState(false);
  return <section className="space-y-4 rounded-xl border p-5 print:hidden"><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={()=>window.print()}>Print / save PDF</Button><Button variant="outline" asChild><a href={`/api/placement/reports/${token}/export`}>Download CSV</a></Button></div><p className="text-xs text-muted-foreground">Downloaded copies cannot be revoked. This report is intended only for the approved recipient.</p><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);try{await mutate("/api/placement",{action:"interview",token,student_ids:f.getAll("students"),message:f.get("message")});toast.success("Interview request sent to the placement cell.");form.reset();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}><h2 className="font-medium">Request interviews through the placement cell</h2><div className="flex flex-wrap gap-4">{candidates.map(c=><label key={c.id} className="flex gap-2 text-sm"><input type="checkbox" name="students" value={c.id}/>{c.name}</label>)}</div><textarea name="message" aria-label="Interview request details" placeholder="Interview format, proposed dates and contact details" required minLength={10} maxLength={3000} className={fieldClass}/><Button disabled={busy||!candidates.length}>{busy?"Sending…":"Request interviews"}</Button></form></section>;
}
