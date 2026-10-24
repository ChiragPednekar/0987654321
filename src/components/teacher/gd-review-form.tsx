"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {fieldClass,mutate} from "@/components/placement/forms";
export function GdReviewForm({sessionId,userId}:{sessionId:string;userId:string}) {
  const [busy,setBusy]=useState(false);const router=useRouter();
  return <form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await mutate(`/api/gd/sessions/${sessionId}/review`,{user_id:userId,scores:Object.fromEntries(["contribution","listening","collaboration","clarity"].map(k=>[k,Number(f.get(k))])),feedback:f.get("feedback")});toast.success("Feedback shared with the student");router.refresh();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}><div className="grid gap-3 sm:grid-cols-4">{["contribution","listening","collaboration","clarity"].map(k=><label key={k} className="text-xs capitalize">{k} / 5<input name={k} type="number" min={0} max={5} required className={fieldClass}/></label>)}</div><textarea name="feedback" aria-label="Discussion feedback" required minLength={30} maxLength={4000} rows={3} placeholder="Describe observed contributions, listening and one actionable next step. Do not infer personality from appearance or accent." className={fieldClass}/><Button disabled={busy}>{busy?"Saving…":"Save teacher feedback"}</Button></form>;
}
