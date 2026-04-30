"""
护眼Pet - 图片处理后端
功能：去背景 + Q版化处理
"""

import io
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from rembg import remove
from PIL import Image, ImageEnhance
import numpy as np

app = FastAPI(title="护眼Pet API")

# CORS 配置（允许所有来源，方便桌面端调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== 核心处理函数 =====================

def make_q_version(input_image: Image.Image) -> Image.Image:
    """
    将宠物图片处理成 Q 版可爱风格
    步骤：
    1. 移除背景 → 透明底 PNG
    2. 调整色调（偏粉嫩）
    3. 增强对比度和饱和度（使颜色更鲜明）
    4. 轻微模糊边缘（圆润感）
    """
    # Step 1: 移除背景
    img_bytes = io.BytesIO()
    input_image.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    result_bytes = remove(img_bytes.read())
    result_image = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
    
    # Step 2: Q版风格调整
    # 色调偏粉嫩
    enhancer = ImageEnhance.Color(result_image)
    result_image = enhancer.enhance(1.3)  # 增加饱和度
    
    # 亮度微调
    enhancer = ImageEnhance.Brightness(result_image)
    result_image = enhancer.enhance(1.05)
    
    # 对比度增强
    enhancer = ImageEnhance.Contrast(result_image)
    result_image = enhancer.enhance(1.1)
    
    # 边缘圆润处理（通过轻微模糊再锐化）
    # 简化处理：只做颜色增强，不做复杂形变
    
    return result_image


def image_to_base64(img: Image.Image, format='PNG') -> str:
    """将 PIL Image 转为 base64 字符串"""
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ===================== API 路由 =====================

@app.get("/")
def home():
    return {"message": "护眼Pet API 正常运行 💕", "version": "1.0.0"}


@app.post("/process-qversion")
async def process_qversion(file: UploadFile = File(...)):
    """
    处理图片：去背景 + Q版化
    POST multipart/form-data
    返回: { "success": true, "image": "base64字符串" }
    """
    try:
        # 读取上传的图片
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents)).convert("RGBA")
        
        # 处理
        q_version = make_q_version(input_image)
        
        # 返回 base64
        img_b64 = image_to_base64(q_version, 'PNG')
        
        return JSONResponse({
            "success": True,
            "image": img_b64,
            "format": "png"
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    """
    只移除背景
    """
    try:
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents)).convert("RGBA")
        
        result_bytes = remove(contents)
        result_image = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
        
        img_b64 = image_to_base64(result_image, 'PNG')
        
        return JSONResponse({
            "success": True,
            "image": img_b64,
            "format": "png"
        })
        
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


# ===================== 启动 =====================
if __name__ == "__main__":
    print("🚀 启动护眼Pet图片处理服务...")
    print("📍 地址: http://localhost:8765")
    uvicorn.run(app, host="0.0.0.0", port=8765)
