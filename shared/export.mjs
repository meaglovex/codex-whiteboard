import { translate } from './i18n.mjs';

function progressMarkdown(board,t){
  if(!board.progress)return [];
  const p=board.progress;
  const references=(ids,items)=>ids.length?ids.map(id=>{const item=items.find(value=>value.id===id);return `${item?.title||id} (\`${id}\`)`;}).join(', '):t('export.none');
  return [
    '\n## '+t('development'),t('export.synced',{time:p.updatedAt}),t('export.latest',{summary:p.summary}),t('export.project',{path:board.projectPath||t('export.unlinked')}),
    ...p.milestones.flatMap(m=>[
      `\n### ${m.title}`,t('export.milestoneId',{id:m.id}),m.description,
      t('export.milestoneDeps',{items:references(m.dependsOn,p.milestones)}),
      ...p.tasks.filter(task=>task.milestoneId===m.id).flatMap(task=>[
        `\n#### ${task.title} (${t('status.'+task.status)})`,t('export.taskId',{id:task.id}),
        t('export.taskDeps',{items:references(task.dependsOn,p.tasks)}),
        `${t('acceptance')}：${task.acceptance}`,task.description,
        task.blocker?t('export.blocker',{value:task.blocker}):'',task.note,
        ...task.evidence.map(e=>`- ${e.label} [${t('result.'+e.result)}]：${e.reference}${e.detail?'\n  '+e.detail:''}`),
      ]),
    ]),
    '\n### '+t('export.activity'),...p.events.slice(-20).map(event=>`- ${event.at}：${event.summary}`),
  ];
}
function details(items,depth=0){return items.map(detail=>`${'  '.repeat(depth)}- ${detail.title}：${detail.body}${detail.children?.length?'\n'+details(detail.children,depth+1):''}`).join('\n');}
function card(value,t){return [
  value.body,
  value.steps?.length?t('export.flow',{value:value.steps.map(step=>`${step.title}${step.sub?' ('+step.sub+')':''}`).join(' → ')}):'',
  value.prototype?[
    t('export.prototypeTitle',{value:value.prototype.screenTitle}),t('export.prototypeAction',{value:value.prototype.actionLabel}),
    t('export.prototypeInput',{value:value.prototype.placeholder}),t('export.prototypeSuccess',{value:value.prototype.successText}),
  ].join('\n'):'',
  value.image?t('export.image'):'',details(value.details),
].filter(Boolean).join('\n');}
export function toMarkdown(board,locale='zh-CN'){
  const t=(key,params)=>translate(locale,key,params);
  const name=id=>board.nodes.find(node=>node.id===id)?.data.title||id;
  return [
    `# ${board.title}`,'',t('export.goal',{value:board.goal}),t('export.references',{value:board.inspirations.join('、')||t('export.unspecified')}),'',
    '## '+t('export.board'),...board.nodes.map(node=>`\n### ${node.data.title} (${t(node.data.pinned?'export.pinned':'discussing')})\n${t('export.nodeId',{id:node.id})}\n${card(node.data,t)}`),
    '\n## '+t('export.relationships'),...board.edges.map(edge=>`- ${name(edge.source)} → ${name(edge.target)}`),
    ...(board.plan?['\n## '+t('planTitle'),t('export.plan',{title:board.plan.title}),t('export.synced',{time:board.plan.updatedAt}),t('export.fullPlan')]:[]),
    ...progressMarkdown(board,t),
    '\n## '+t('export.discussion'),...board.messages.map(message=>`\n${message.role==='ai'?'AI':t('export.user')}：${message.text}${message.suggestions?.length?'\n\n'+t('export.proposals')+'\n'+message.suggestions.map(suggestion=>`\n### ${suggestion.title}\n${card(suggestion,t)}`).join('\n'):''}`),
  ].join('\n');
}
