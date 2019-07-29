class ToolStack{
	constructor(){
		var self = this;
		var selectAndMoveTool = new PAPER.Tool({
			onMouseDown: function(event){
				var hit = PAPER.project.hitTest(event.point);
				PAPER.project.deselectAll();
				if(hit){
					hit.item.selected = true;
				}
				reset = true;
				updateGui();
			},
			onMouseDrag: function(event) {
				for(var item of PAPER.project.selectedItems){
					if(!item.locked){
						if(event.modifiers.alt){
							item.rotate((event.delta.y+event.delta.x)/3.0);
						}else{
							item.position = item.position.add(event.delta);
						}
					}
					if(item.data.generator){
						item.data.generator.position = item.data.generator.position.add(event.delta);
					}
				}
				reset = true;
			},
			onKeyDown: function(event){
				if(event.event.srcElement.tagName != "INPUT"){ //!!! temporary fix for bubbling keyboard events
					if(event.key == "backspace"){
						for(var item of PAPER.project.selectedItems){
							item.remove();
						}
					}
				}
			}
		});

		var circleTool = new PAPER.Tool({
			onMouseDown: function(event){
				PAPER.project.deselectAll();
			},
			onMouseDrag: function(event){
				if(this.circle)
					this.circle.remove();
				var scale = event.downPoint.getDistance(event.point);
				this.circle = new PAPER.Path.Circle({
					center: event.downPoint,
					radius: scale,
					strokeColor: 'rgba(128, 128, 128, 0.7)',
					fillColor: GlassColor,
					strokeWidth: 3,
					parent: sceneLayer,
					data: {
						'material': "mirror"
					}
				});
				this.circle.selected = true;
			},
			onMouseUp: function(event){
				this.circle = null;
				self.activateTool("selectAndMoveTool");
			}
		});
		

		var lensTool = new PAPER.Tool({
			onMouseDown: function(event){
				PAPER.project.deselectAll();
			},
			onMouseDrag: function(event){
				if(this.lens)
					this.lens.remove();

				var size = event.downPoint.subtract(event.point);

				this.lens = new PAPER.Path({
					strokeColor: 'rgba(128, 128, 128, 0.7)',
					fillColor: GlassColor,
					strokeWidth: 3,
					parent: sceneLayer,
					data: {
						'material': "transparent"
					}
				});


				var R = 1/2.2;
				if(event.downPoint.x<event.point.x){
					this.lens.add(event.point.x*R+event.downPoint.x*(1-R), event.downPoint.y);
					this.lens.lineTo( event.point.x*(1-R)+event.downPoint.x*R, event.downPoint.y);

					this.lens.arcTo(
						new PAPER.Point( event.point.x, (event.point.y+event.downPoint.y)/2 ),
						new PAPER.Point( event.point.x*(1-R)+event.downPoint.x*R, event.point.y )
					)
					this.lens.lineTo( event.point.x*R+event.downPoint.x*(1-R), event.point.y);
					this.lens.arcTo(
						new PAPER.Point( event.downPoint.x, (event.point.y+event.downPoint.y)/2 ),
						new PAPER.Point( event.point.x*R+event.downPoint.x*(1-R), event.downPoint.y )
					)
				}else{
					this.lens.add(event.point.x, event.downPoint.y);
					this.lens.lineTo(event.downPoint.x, event.downPoint.y);

					this.lens.arcTo(
						new PAPER.Point( event.point.x*R+event.downPoint.x*(1-R), (event.point.y+event.downPoint.y)/2 ),
						new PAPER.Point( event.downPoint.x, event.point.y )
					)
					this.lens.lineTo(event.point);
					this.lens.arcTo(
						new PAPER.Point( event.point.x*(1-R)+event.downPoint.x*R, (event.point.y+event.downPoint.y)/2 ),
						new PAPER.Point( event.point.x, event.downPoint.y )
					)
				}
				this.lens.selected = true;
			},
			onMouseUp: function(event){
				this.lens = null;
				self.activateTool("selectAndMoveTool");
			}
		});
		

		var rectTool = new PAPER.Tool({
			onMouseDown: function(event){
				PAPER.project.deselectAll();
			},
			onMouseDrag: function(event){
				if(this.rect)
					this.rect.remove();

				var size = event.downPoint.subtract(event.point);

				this.rect = new PAPER.Path.Rectangle(event.downPoint, event.point);

				this.rect.strokeColor = 'rgba(128, 128, 128, 0.7)';
				this.rect.fillColor = GlassColor;
				this.rect.strokeWidth = 3;
				this.rect.parent = sceneLayer,
				this.rect.data = {
						'material': "diffuse"
					}
				this.rect.selected = true;
			},
			onMouseUp: function(event){
				this.rect = null;
				self.activateTool("selectAndMoveTool");
			}
		});

		selectAndMoveTool.name = "selectAndMoveTool";
		circleTool.name = "circleTool";
		lensTool.name = "lensTool";
		rectTool.name = "rectTool";
		this.tools = [selectAndMoveTool, circleTool, lensTool, rectTool];

		this._eventHandlers = {
			'activated': []
		};
	}

	activateTool(name){
		const tool = this.tools.find(tool=> tool.name === name);
		tool.activate();
		for(var handler of this._eventHandlers['activated']){
			handler(tool);
		}
	}

	isToolActive(name){
		const tool = this.tools.find(tool=> tool.name === name);
		return tool.isActive();
	}

	attach(event, handler){
		this._eventHandlers[event].push(handler);
	}

	detach(event, handler){
		this._eventHandlers[event].remove(handler);
	}

}