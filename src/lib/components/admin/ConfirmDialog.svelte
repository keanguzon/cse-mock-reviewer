<script lang="ts">
 import { onMount } from 'svelte';
 import { TriangleAlert } from 'lucide-svelte';
 let {title,busy=false,onClose,children,returnFocus=null}=$props<{title:string;busy?:boolean;onClose:()=>void;children:import('svelte').Snippet;returnFocus?:HTMLElement|null}>();let dialog:HTMLDialogElement;
 onMount(()=>{const previous=returnFocus??document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();previous?.focus();};});
</script>
<dialog bind:this={dialog} aria-labelledby="admin-dialog-title" oncancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <header class="confirm-header"><span class="confirm-icon" aria-hidden="true"><TriangleAlert size={26}/></span><h2 id="admin-dialog-title">{title}</h2></header>
 <div class="confirm-content">{@render children()}</div>
</dialog>
<style>
 dialog {
  background: #171923;
  color: var(--cse-text);
  font-family: var(--font-body);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: var(--cse-radius);
  padding: 2rem;
  margin: auto;
  width: min(440px,calc(100vw - 3rem));
  max-height: calc(100dvh - 3rem);
  overflow: auto;
  box-shadow: 0 25px 60px rgba(0,0,0,.65),0 0 40px rgba(124,58,237,.06);
 }
 dialog::backdrop { background: rgba(0,0,0,.9); }
 .confirm-header { display:flex;flex-direction:column;align-items:center;text-align:center;gap:.75rem;margin-bottom:1.25rem; }
 .confirm-icon { display:flex;align-items:center;justify-content:center;width:3.5rem;height:3.5rem;border-radius:50%;background:rgba(248,113,113,.12);color:var(--cse-red);border:2px solid rgba(248,113,113,.25); }
 .confirm-header h2 { font-family:var(--font-display);font-size:1.4rem;font-weight:800;letter-spacing:-.3px;color:white;margin:0; }
 .confirm-content { font-size:.95rem;line-height:1.55;overflow-wrap:anywhere; }
 .confirm-content :global(p) { margin-bottom:1rem; }
 .confirm-content :global(label) { display:block;margin-top:1rem; }
 .confirm-content :global(input) { display:block;width:100%;margin-top:.5rem; }
 .confirm-content :global(.toolbar) { margin-top:1.75rem;margin-bottom:0;align-items:stretch; }
 .confirm-content :global(.toolbar button) { flex:1;padding:.85rem 1rem;font-size:.85rem;font-weight:700; }
 @media(max-width:600px) { dialog { padding:1.5rem;width:calc(100vw - 2rem);max-height:calc(100dvh - 2rem); } }
</style>
