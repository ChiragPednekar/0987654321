"use client";
import * as React from "react";
import {toast} from "sonner";
import {Tabs} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {useProctor,type ProctorApi} from "@/hooks/use-proctor";
import {formatDuration} from "@/lib/utils";
export interface CaseQuestionData {scenario:string;instructions:string;supporting_data?:unknown;attachments?:unknown[];expected_framework?:string|null;}
interface CaseProctorContextValue {proctor:ProctorApi;startedAt:number;elapsed:number;finishAttempt:()=>void;question:CaseQuestionData|null;hasSubmitted:boolean;practice:boolean;}
const CaseProctorContext=React.createContext<CaseProctorContextValue|null>(null);
export function useCaseProctor(){return React.useContext(CaseProctorContext);}
interface Props {caseId:string;slug:string;signedIn:boolean;entitled:boolean;defaultTab:string;hasSubmissionParam:boolean;hasSubmitted:boolean;initialQuestion?:CaseQuestionData|null;children:React.ReactNode;}
/** Ordinary case practice deliberately has no camera, fullscreen or integrity monitoring.
 * The existing context keeps drill/model editors compatible; contests use their own proctor.
 */
export function CaseProctorShell({slug,signedIn,entitled,defaultTab,hasSubmissionParam,hasSubmitted,initialQuestion,children}:Props){
  const disabledProctor=useProctor(false);
  const [question,setQuestion]=React.useState(initialQuestion??null);
  const [opening,setOpening]=React.useState(false);const [paused,setPaused]=React.useState(false);
  const [tab,setTab]=React.useState(defaultTab);const [previous,setPrevious]=React.useState(defaultTab);
  const [completed,setCompleted]=React.useState(hasSubmissionParam);
  const [startedAt,setStartedAt]=React.useState(()=>Date.now());const [elapsed,setElapsed]=React.useState(0);
  if(previous!==defaultTab){setPrevious(defaultTab);setTab(defaultTab);}
  React.useEffect(()=>{if(!question||paused||completed)return;const timer=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(timer);},[question,paused,completed]);
  async function start(){setOpening(true);try{const res=await fetch("/api/cases/open",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({slug})});const data=await res.json();if(!res.ok)throw new Error(data.error);setQuestion(data);setCompleted(false);setPaused(false);setStartedAt(Date.now());setElapsed(0);}catch(e){toast.error((e as Error).message);}finally{setOpening(false);}}
  const proctor:ProctorApi={...disabledProctor,examMode:Boolean(question),handlers:{onPaste:()=>{},onKeyDown:()=>{}}};
  if(signedIn&&entitled&&!question&&!hasSubmissionParam)return <div className="space-y-4 rounded-xl border p-6"><h2 className="text-xl font-medium">Practise at your own pace</h2><p className="text-sm text-muted-foreground">Use hints, pause and retry. No camera or fullscreen is required. Your practice history is not included in company reports.</p><Button disabled={opening} onClick={start}>{opening?"Opening…":"Start practice"}</Button></div>;
  return <CaseProctorContext.Provider value={{proctor,startedAt,elapsed,finishAttempt:()=>setCompleted(true),question,hasSubmitted,practice:true}}><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-xs"><span>Practice · hints and learning resources welcome</span><div className="flex items-center gap-3"><span>{formatDuration(elapsed)}</span>{question&&<Button variant="outline" size="sm" onClick={()=>{setCompleted(false);setPaused(v=>!v);}}>{paused?"Resume":"Pause"}</Button>}{!question&&signedIn&&entitled&&<Button size="sm" variant="outline" disabled={opening} onClick={start}>Practise again</Button>}</div></div>{paused?<div className="rounded-lg border p-10 text-center text-sm">Practice paused. Your draft stays in this browser.<Button className="ml-3" onClick={()=>setPaused(false)}>Resume</Button></div>:<Tabs value={tab} onValueChange={setTab}>{children}</Tabs>}</CaseProctorContext.Provider>;
}
