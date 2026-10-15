"""Read private, locally supplied Doom patches and composed wall textures."""
import struct
from PIL import Image

class DoomArt:
    def __init__(self,path):
        blob=path.read_bytes();count,directory=struct.unpack_from('<II',blob,4)
        self.lumps={}
        for n in range(count):
            off,size,name=struct.unpack_from('<II8s',blob,directory+n*16)
            self.lumps[name.rstrip(b'\0').decode()]=blob[off:off+size]
        self.palette=self.lumps['PLAYPAL'][:768]
        data=self.lumps['PNAMES']
        self.names=[data[4+n*8:12+n*8].rstrip(b'\0').decode() for n in range(struct.unpack_from('<I',data)[0])]
        self.textures={}
        for table in ['TEXTURE1','TEXTURE2']:
            data=self.lumps.get(table)
            if not data:continue
            for n in range(struct.unpack_from('<I',data)[0]):
                off=struct.unpack_from('<I',data,4+n*4)[0]
                name=data[off:off+8].rstrip(b'\0').decode()
                w,h=struct.unpack_from('<HH',data,off+12)
                patches=[struct.unpack_from('<hhHHH',data,off+22+i*10)[:3] for i in range(struct.unpack_from('<H',data,off+20)[0])]
                self.textures[name]=(w,h,patches)

    def patch(self,name):
        data=self.lumps[name];w,h=struct.unpack_from('<HH',data)
        image=Image.new('RGBA',(w,h))
        for x in range(w):
            pos=struct.unpack_from('<I',data,8+x*4)[0]
            while data[pos]!=255:
                top,length=data[pos:pos+2]
                for y,color in enumerate(data[pos+3:pos+3+length]):
                    if top+y<h:image.putpixel((x,top+y),(*self.palette[color*3:color*3+3],255))
                pos+=length+4
        return image

    def texture(self,name):
        w,h,patches=self.textures[name];image=Image.new('RGBA',(w,h))
        for x,y,index in patches:image.alpha_composite(self.patch(self.names[index]),(x,y))
        return image
