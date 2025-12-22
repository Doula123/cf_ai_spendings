import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep,} from "cloudflare:workers";
import type {Env, Params} from "../types";
import { analyzeText } from "../analyzeText"


export class AnalyzeWorkflow extends WorkflowEntrypoint<Env, Params> {

    async run(event:WorkflowEvent<Params>, step: WorkflowStep)
    {
        const {runId, text} = event.payload;


        // 1) Mark run as running

        await step.do("Mark as running", async () => {
            await this.env.DB
                .prepare("UPDATE runs SET status = 'running' WHERE id = ?1")
                .bind(runId)
                .run();
        });

        // 2) Analyze Text
        try{

        const result = await step.do("Analyze spending", {timeout: "60 seconds"},
                       async () => 
                       {
                        return analyzeText(this.env, text);
                       });

        // 3) Save results
        await step.do("Save results", async () => {
                    await this.env.DB.prepare(`UPDATE runs SET summary_json = ?1, status = 'completed' WHERE id = ?2`)
                                     .bind(JSON.stringify
                                        (result), runId).run();
                                });
        } catch (err)
        {
            const message = err instanceof Error ? err.message : "Unknown error";

            await step.do("Mark as failed", async () => {
                await this.env.DB
                .prepare("UPDATE runs SET status = 'failed', summary_json = ?1 WHERE id = ?2")
                .bind(JSON.stringify({ error: message }), runId)
                .run();
                 });
            throw err;
        }
    }
}