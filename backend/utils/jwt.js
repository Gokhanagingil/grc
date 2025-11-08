const jwt = require('jsonwebtoken');
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4e4f8ecf6216';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';

function auth(req,res,next){
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token){
    req.authFailure = 'no_token';
    return res.status(401).json({message:'Unauthorized'});
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch(e){
    req.authFailure = 'invalid_token';
    return res.status(401).json({message:'Unauthorized'});
  }
}

function tenantGuard(req,res,next){
  const tid = req.headers['x-tenant-id'];
  if(!tid){ return res.status(403).json({message:'Tenant required'}); }
  if(String(tid)!==String(DEFAULT_TENANT_ID)){ return res.status(403).json({message:'Forbidden tenant'}); }
  next();
}

function signUser(userId) {
  return jwt.sign({ sub: userId, iat: Math.floor(Date.now()/1000) }, JWT_SECRET, { expiresIn:'1d' });
}

module.exports = { auth, tenantGuard, signUser };
