"use strict";

/**
 * Image class is used to store image data that is used to create Textures.
 * 
 * Images can be stored in mutiple formats but on serialization images are converted to JPEG if they are opaque or to PNG if they are transparent.
 * 
 * GIF images are never converted to prevert animation capabilities.
 * 
 * @class Image
 * @constructor
 * @extends {Resource}
 * @module Resources
 * @param {ArrayBuffer, Base64, String} data Can be URL to image, ArrayBuffer data or base64 encoded data.
 * @param {String} encoding Image encoding, required for ArrayBuffer data.
 */
function Image(url, encoding)
{
	Resource.call(this, "image", "Image");

	if(url !== undefined)
	{
		//ArrayBuffer
		if(url instanceof window.ArrayBuffer)
		{
			if(encoding === "tga")
			{
				this.loadTGAData(url);
			}
			else
			{
				this.loadArrayBufferData(url, encoding);
			}
		}
		//Base64
		else if(Base64Utils.isBase64(url))
		{
			this.encoding = Base64Utils.getFileFormat(url);
			this.format = "base64";
			this.data = url;
		}
		//URL
		else
		{
			this.encoding = FileSystem.getFileExtension(url);
			
			if(this.encoding === "tga")
			{
				this.loadTGAData(FileSystem.readFileArrayBuffer(url));
			}
			else
			{
				this.format = "url";
				this.data = url;
			}
		}
	}
	else
	{
		this.createSolidColor();
	}
}

Image.prototype = Object.create(Resource.prototype);

/**
 * Check if a file name refers to a supported binary image file.
 *
 * @method fileIsImage
 * @static
 * @param {File} file
 * @return {boolean} True if the file refers to a supported image format.
 */
Image.fileIsImage = function(file)
{
	if(file !== undefined)
	{
		if(file.type.startsWith("image"))
		{
			return true;
		}

		file = file.name.toLocaleLowerCase();
		return file.endsWith("tga");
	}

	return false;
};

/**
 * Create a new image with 1x1 resolution with solid color.
 *
 * Can be called externally on data load error to load dummy data.
 *
 * @method createSolidColor
 * @param {String} color Color code
 */
Image.prototype.createSolidColor = function(color)
{
	var canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;

	var context = canvas.getContext("2d");
	context.fillStyle = (color !== undefined) ? color : MathUtils.randomColor();
	context.fillRect(0, 0, 1, 1);

	this.data = canvas.toDataURL("image/png");
	this.format = "base64";
	this.encoding = "png";
};

/**
 * Load arraybuffer data to this image.
 *
 * Creates a blob with data to be stored on data atribute and used by external objects.
 *
 * @method loadArrayBufferData
 * @param {ArrayBuffer} data Data to be loaded.
 * @param {String} encoding Image enconding (jpeg, png, etc).
 */
Image.prototype.loadArrayBufferData = function(data, encoding)
{
	var view = new Uint8Array(data);
	var blob = new Blob([view], {type: "image/" + encoding});

	this.data = URL.createObjectURL(blob);
	this.arraybuffer = data;
	this.encoding = encoding;
	this.format = "arraybuffer";
};

/**
 * Load .tga file from ArrayBuffer data.
 *
 * After loading data is converted to JPEG format and stored in base64 encoding.
 * 
 * @method loadTGAData
 * @param {ArrayBuffer} data Data to be loaded.
 */
Image.prototype.loadTGAData = function(data)
{
	var canvas = new THREE.TGALoader().parse(data);
	this.encoding = "jpeg";
	this.format = "base64";
	this.data = canvas.toDataURL("image/jpeg", 1.0);
};

/**
 * Check if this image has alpha channel.
 *
 * This checks the file encoding if the file a GIF or a PNG is assumed that the file has alpha channel.
 *
 * @method hasTransparency
 * @return {boolean} True if the image is encoded as PNG or GIF
 */
Image.prototype.hasTransparency = function()
{
	return this.encoding === "png" || this.encoding === "gif";
};

/**
 * Compresses image data to JPEG or PNG and stores in base64 encoding.
 *
 * If the image has transparency it is stored as PNG otherwise the image is stored in JPEG with 1.0 quality.
 *
 * Can be used to compress data and save space.
 * 
 * @method encodeData
 */
Image.prototype.encodeData = function()
{
	var image = document.createElement("img");
	image.src = this.data;

	var canvas = document.createElement("canvas");
	canvas.width = image.width;
	canvas.height = image.height;

	var context = canvas.getContext("2d");
	context.drawImage(image, 0, 0, image.width, image.height);

	//Check if the image has some transparency
	var transparent = false;
	var data = context.getImageData(0, 0, image.width, image.height).data;
	for(var i = 3; i < data.length; i += 4)
	{
		if(data[i] !== 255)
		{
			transparent = true;
			break;
		}
	}

	//Encode data
	if(transparent)
	{
		this.encoding = "png";
		this.format = "base64";
		this.data = canvas.toDataURL("image/png");
	}
	else
	{
		this.encoding = "jpeg";
		this.format = "base64";
		this.data = canvas.toDataURL("image/jpeg", 1.0);
	}
};

/**
 * Serialize Image resource to json.
 *
 * If image is stored as URL it is converter to PNG or JPEG.
 *
 * @method toJSON
 * @param {Object} meta
 * @return {Object} json
 */
Image.prototype.toJSON = function(meta)
{
	var data = Resource.prototype.toJSON.call(this, meta);

	if(meta.images[this.uuid] !== undefined)
	{
		return meta.images[this.uuid];
	}

	if(this.format === "url")
	{
		this.loadArrayBufferData(FileSystem.readFileArrayBuffer(this.data), this.encoding);
	}

	data.encoding = this.encoding;

	if(this.format === "arraybuffer")
	{
		data.format = this.format;
		data.data = this.arraybuffer;
	}
	else if(this.format === "base64")
	{
		data.format = "arraybuffer";
		data.data = ArraybufferUtils.fromBase64(Base64Utils.removeHeader(this.data));
	}
	else
	{
		data.format = this.format;
		data.data = this.data;
	}
	
	meta.images[this.uuid] = data;

	return data;
};
