class LensGenerator{
	constructor(options={}){
		this._group = new PAPER.Group(options);
		this._group.data.generator = this;
		this.distance = 950;
		this.radius = 500;
		this._left = null;
		this._right = null;
		this._lens = null;
		this.position = options.center ? options.center : new PAPER.Point();
		this.generate();
		
	}
	generate(){
		// if items are removed from a PAPEr group selection is lost.
		// if group is selected then reselect after
		var selected = this._group.selected;
		
		if(this._right)
			this._right.remove();
		if(this._lens)
			this._lens.remove();

		this._left = new PAPER.Path.Circle({
			center: this.position.add(this.distance/2, 0),
			radius: this.radius,
			locked: true,
			insert: false
		});

		this._right = new PAPER.Path.Circle({
			center: this.position.add(-this.distance/2, 0),
			radius: this.radius,
			locked: true,
			insert: false
		});

		this._lens = this._left.intersect(this._right);
		this._lens.fillColor = 'black';
		this._lens.parent = this._group;
		this._lens.strokeColor = "white";
		this._lens.strokeWidth = 1;

		if(selected)
			this._group.selected = selected;
	}
}