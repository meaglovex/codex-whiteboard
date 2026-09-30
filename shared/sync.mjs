export function mergeDetails(previous=[], incoming=[]) {
  const result=structuredClone(previous);
  for(const next of incoming){const index=result.findIndex(item=>item.id===next.id);if(index<0)result.push(structuredClone(next));else result[index]={...result[index],...next,children:mergeDetails(result[index].children,next.children)};}
  return result;
}

export function syncConversation(board,{title,goal,inspirations,cards=[],links=[],messages=[]}) {
  if(title!==undefined)board.title=title;
  if(goal!==undefined)board.goal=goal;
  if(inspirations!==undefined)board.inspirations=inspirations;
  for(const {id,card} of cards){
    const node=board.nodes.find(n=>n.id===id);
    if(node)node.data={...node.data,...card,details:mergeDetails(node.data.details,card.details)};
    else board.nodes.push({id,type:'boardCard',dragHandle:'.drag-handle',position:{x:96+(board.nodes.length%2)*600,y:180+Math.floor(board.nodes.length/2)*440},data:{pinned:false,details:[],...card}});
  }
  for(const link of links){const id=link.id||`${link.source}-${link.target}`;const edge={id,source:link.source,target:link.target,sourceHandle:'right',targetHandle:'left',type:'default'};const index=board.edges.findIndex(e=>e.id===id);if(index<0)board.edges.push(edge);else board.edges[index]=edge;}
  for(const message of messages){const index=board.messages.findIndex(m=>m.id===message.id);if(index<0)board.messages.push(message);else board.messages[index]={...board.messages[index],...message};}
  return board;
}
